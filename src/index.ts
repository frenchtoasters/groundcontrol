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
  createConfigHook,
  createDelegateTaskRetryHook,
  createDirectoryAgentsInjectorHook,
  createKeywordDetectorHook,
  createSessionNotification,
  createSessionSaverHook,
  createTaskResumeInfoHook,
} from "./hooks/index.js"
import { loadBuiltinCommands, writeCommandFiles } from "./commands/index.js"
import { ensureDirectory } from "./utils/fs.js"

const SERVICE_NAME = "groundcontrol"

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

  // Write command markdown files to ~/.config/opencode/commands/
  // This is the documented mechanism for registering slash commands with OpenCode
  const builtinCommands = loadBuiltinCommands(config)
  try {
    await writeCommandFiles(builtinCommands)
  } catch (error) {
    void client.app.log?.({
      body: {
        service: SERVICE_NAME,
        level: "warn",
        message: "Failed to write command files",
        extra: { error: error instanceof Error ? error.message : String(error) },
      },
    })
  }

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

  // --- tool.execute.before / tool.execute.after hooks ---

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

  // --- chat.message hook ---

  const keywordHook = config.hooks.keywordDetector.enabled
    ? createKeywordDetectorHook({ subagentSessions: manager.getSubagentSessions() })
    : undefined

  // --- config hook (registers slash commands) ---

  const configHook = createConfigHook(config)

  // --- event hook (session notification + session saver) ---

  const eventHandlers: Array<(input: { event: { type: string; properties?: Record<string, unknown> } }) => Promise<void>> = []

  if (config.hooks.sessionNotification.enabled) {
    eventHandlers.push(createSessionNotification({
      idleDelayMs: config.hooks.sessionNotification.idleDelayMs,
      sound: config.hooks.sessionNotification.sound,
    }) as any)
  }

  eventHandlers.push(createSessionSaverHook({
    sessionLogPath,
    client: client as any,
  }) as any)

  const composedEventHook = async (input: { event: { type: string; properties?: Record<string, unknown> } }): Promise<void> => {
    for (const handler of eventHandlers) {
      await handler(input)
    }
  }

  return {
    tool: tools,
    config: configHook,
    "chat.message": keywordHook,
    event: composedEventHook,
    "tool.execute.before": composeHook(hooksBefore),
    "tool.execute.after": composeHook(hooksAfter),
  }
}
