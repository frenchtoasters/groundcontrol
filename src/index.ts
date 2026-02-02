import fs from "node:fs/promises"
import path from "node:path"
import type { Plugin } from "@opencode-ai/plugin"
import type { GroundcontrolConfig } from "./config.js"
import {
  evaluateAllowedProviders,
  enforceAllowedProviders,
  loadGroundcontrolConfig,
  loadOpencodeConfig,
  resolveSessionLogPath,
} from "./config.js"
import { BackgroundTaskManager } from "./background/manager.js"
import {
  createAstGrepTools,
  createBackgroundCancelTool,
  createBackgroundOutputTool,
  createBackgroundTaskTool,
  createDelegateTaskTool,
} from "./tools/index.js"
import {
  createCommentCheckerHooks,
  createDelegateTaskRetryHook,
  createDirectoryAgentsInjectorHook,
  createKeywordDetectorHook,
  createSessionNotification,
  createTaskResumeInfoHook,
} from "./hooks/index.js"
import { ensureDirectory } from "./utils/fs.js"
import { formatMessageLines, resolveSessionId } from "./utils/session.js"
import { loadBuiltinCommands } from "./commands/index.js"
import { createSlashCommandTool } from "./commands/slashcommand-tool.js"

const SERVICE_NAME = "groundcontrol"

const renderSessionMarkdown = async (
  client: Parameters<Plugin>[0]["client"],
  sessionId: string,
): Promise<string> => {
  const response = await client.session.messages({ path: { id: sessionId } })
  const entries = (response as { data?: unknown }).data ?? response

  if (!Array.isArray(entries)) {
    return ""
  }

  const lines: string[] = []
  for (const entry of entries) {
    lines.push(formatMessageLines(entry as { info?: { role?: string } }))
    lines.push("")
  }
  return `${lines.join("\n")}\n`
}

const composeHook = (handlers: Array<(input: any, ctx?: any) => Promise<void>>) => {
  return async (input: any, ctx?: any): Promise<void> => {
    for (const handler of handlers) {
      await handler(input, ctx)
    }
  }
}

const buildTools = (
  config: GroundcontrolConfig,
  manager: BackgroundTaskManager,
  client: Parameters<Plugin>[0]["client"],
): Record<string, unknown> => {
  const tools: Record<string, unknown> = {}

  if (config.tools.astGrep.enabled) {
    Object.assign(tools, createAstGrepTools(config))
  }

  if (config.tools.delegation.enabled) {
    tools.delegate_task = createDelegateTaskTool(manager, client as any, config)
    tools.background_task = createBackgroundTaskTool(manager)
    tools.background_output = createBackgroundOutputTool(manager)
    tools.background_cancel = createBackgroundCancelTool(manager)
  }

  const commands = loadBuiltinCommands(config)
  tools.slashcommand = createSlashCommandTool(commands)

  return tools
}

export const Groundcontrol: Plugin = async ({ client, worktree }) => {
  let config: GroundcontrolConfig
  let opencodeConfig: Record<string, unknown>

  try {
    config = await loadGroundcontrolConfig()
  } catch (error) {
    void client.app.log?.({
      body: {
        service: SERVICE_NAME,
        level: "error",
        message: "Failed to load groundcontrol config",
        extra: { error: error instanceof Error ? error.message : String(error) },
      },
    })
    throw error
  }

  try {
    opencodeConfig = await loadOpencodeConfig(worktree ?? process.cwd())
  } catch (error) {
    void client.app.log?.({
      body: {
        service: SERVICE_NAME,
        level: "error",
        message: "Failed to load opencode config",
        extra: { error: error instanceof Error ? error.message : String(error) },
      },
    })
    throw error
  }

  const providerDecision = evaluateAllowedProviders(
    opencodeConfig["enabled_providers"],
    config.allowedProviders,
  )

  void client.app.log?.({
    body: {
      service: SERVICE_NAME,
      level: "info",
      message: "Provider allowlist check",
      extra: {
        status: providerDecision.status,
        reason: providerDecision.reason,
        enabledProviders: providerDecision.configuredProviders,
        allowedProviders: providerDecision.allowedProviders,
        disallowedProviders: providerDecision.disallowedProviders,
      },
    },
  })

  try {
    enforceAllowedProviders(opencodeConfig["enabled_providers"], config.allowedProviders)
  } catch (error) {
    void client.app.log?.({
      body: {
        service: SERVICE_NAME,
        level: "error",
        message: "Provider enforcement failed",
        extra: { error: error instanceof Error ? error.message : String(error) },
      },
    })
    throw error
  }

  const sessionLogPath = resolveSessionLogPath(config.sessionLogPath)
  await ensureDirectory(sessionLogPath)

  void client.app.log?.({
    body: {
      service: SERVICE_NAME,
      level: "info",
      message: "Groundcontrol plugin initialized",
      extra: { sessionLogPath },
    },
  })

  const manager = new BackgroundTaskManager(client as any, config)
  const tools = buildTools(config, manager, client as any)

  const hooksBefore: Array<(input: any, ctx?: any) => Promise<void>> = []
  const hooksAfter: Array<(input: any, ctx?: any) => Promise<void>> = []

  if (config.hooks.commentChecker.enabled) {
    const commentHooks = createCommentCheckerHooks({
      customPrompt: config.hooks.commentChecker.customPrompt,
    })
    hooksBefore.push(commentHooks["tool.execute.before"])
    hooksAfter.push(commentHooks["tool.execute.after"])
  }

  if (config.hooks.taskResumeInfo.enabled) {
    const resumeHooks = createTaskResumeInfoHook()
    hooksAfter.push(resumeHooks["tool.execute.after"])
  }

  if (config.hooks.delegateTaskRetry.enabled) {
    const retryHooks = createDelegateTaskRetryHook()
    hooksAfter.push(retryHooks["tool.execute.after"])
  }

  if (config.hooks.directoryAgentsInjector.enabled) {
    const agentsInjectorHooks = createDirectoryAgentsInjectorHook({
      maxLines: config.hooks.directoryAgentsInjector.maxLines,
    })
    hooksAfter.push(agentsInjectorHooks["tool.execute.after"])
  }

  const keywordHook = config.hooks.keywordDetector.enabled
    ? createKeywordDetectorHook({ subagentSessions: manager.getSubagentSessions() })
    : undefined

  const sessionNotificationHook = config.hooks.sessionNotification.enabled
    ? createSessionNotification({
        idleDelayMs: config.hooks.sessionNotification.idleDelayMs,
        sound: config.hooks.sessionNotification.sound,
      })
    : undefined

  const saveSession = async (input: Record<string, unknown>) => {
    const sessionId = resolveSessionId(input)
    if (!sessionId) return

    try {
      const markdown = await renderSessionMarkdown(client, sessionId)
      const outputPath = path.join(sessionLogPath, `${sessionId}.md`)
      await fs.writeFile(outputPath, markdown, "utf8")
    } catch (error) {
      void client.app.log?.({
        body: {
          service: SERVICE_NAME,
          level: "warn",
          message: "Failed to export session markdown",
          extra: { sessionId, error: (error as Error).message },
        },
      })
    }
  }

  return {
    tool: tools,
    "chat.message": keywordHook,
    event: sessionNotificationHook,
    "tool.execute.before": composeHook(hooksBefore),
    "tool.execute.after": composeHook(hooksAfter),
    "session.idle": saveSession,
    "session.updated": saveSession,
  } as Record<string, unknown>
}
