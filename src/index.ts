import fs from "node:fs/promises"
import path from "node:path"
import type { GroundcontrolConfig } from "./config.js"
import {
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

type PluginContext = {
  client: {
    app: {
      log?: (args: {
        body: {
          service: string
          level: "debug" | "info" | "warn" | "error"
          message: string
          extra?: Record<string, unknown>
        }
      }) => Promise<unknown>
      toast?: (message: string) => void
    }
    session: {
      create: (args: unknown) => Promise<unknown>
      prompt: (args: unknown) => Promise<unknown>
      messages: (args: { path: { id: string } }) => Promise<{ data?: unknown }>
      status?: (args: unknown) => Promise<{ data?: { status?: string } }>
      abort?: (args: unknown) => Promise<unknown>
    }
  }
  worktree?: string
}

const SERVICE_NAME = "groundcontrol"

const renderSessionMarkdown = async (
  client: PluginContext["client"],
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
  client: PluginContext["client"],
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

export const Groundcontrol = async ({ client, worktree }: PluginContext) => {
  const config = await loadGroundcontrolConfig()
  const opencodeConfig = await loadOpencodeConfig(worktree ?? process.cwd())
  enforceAllowedProviders(opencodeConfig["allowed-providers"], config.allowedProviders)

  const sessionLogPath = resolveSessionLogPath(config.sessionLogPath)
  await ensureDirectory(sessionLogPath)

  await client.app.log?.({
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
      await client.app.log?.({
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
