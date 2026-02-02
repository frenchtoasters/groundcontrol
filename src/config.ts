import os from "node:os"
import path from "node:path"
import { expandHomePath, readJsonFile, writeJsonFile } from "./utils/fs.js"

export type FeatureToggle = {
  enabled: boolean
}

export type GroundcontrolConfig = {
  sessionLogPath: string
  allowedProviders: string[]
  features: {
    backgroundAgents: FeatureToggle & {
      pollIntervalMs: number
      maxPolls: number
    }
  }
  tools: {
    astGrep: FeatureToggle & {
      maxMatches: number
      maxOutputBytes: number
      timeoutMs: number
    }
    delegation: FeatureToggle
  }
  hooks: {
    keywordDetector: FeatureToggle
    commentChecker: FeatureToggle & {
      customPrompt?: string
    }
    sessionNotification: FeatureToggle & {
      idleDelayMs: number
      sound: boolean
    }
    taskResumeInfo: FeatureToggle
    delegateTaskRetry: FeatureToggle
    directoryAgentsInjector: FeatureToggle & {
      maxLines: number
    }
  }
  commands: {
    initDeep: FeatureToggle
    refactor: FeatureToggle
  }
}

export type ProviderEnforcementResult = {
  status: "skipped" | "allowed" | "blocked"
  reason: string
  configuredProviders: string[]
  allowedProviders: string[]
  disallowedProviders: string[]
}

const CONFIG_FILENAME = "groundcontrol.json"

export const DEFAULT_CONFIG: GroundcontrolConfig = {
  sessionLogPath: "~/.opencode/groundcontrol-sessions/",
  allowedProviders: [],
  features: {
    backgroundAgents: {
      enabled: true,
      pollIntervalMs: 2000,
      maxPolls: 300,
    },
  },
  tools: {
    astGrep: {
      enabled: true,
      maxMatches: 500,
      maxOutputBytes: 1024 * 1024,
      timeoutMs: 300_000,
    },
    delegation: {
      enabled: true,
    },
  },
  hooks: {
    keywordDetector: { enabled: true },
    commentChecker: { enabled: true },
    sessionNotification: {
      enabled: true,
      idleDelayMs: 10_000,
      sound: false,
    },
    taskResumeInfo: { enabled: true },
    delegateTaskRetry: { enabled: true },
    directoryAgentsInjector: {
      enabled: true,
      maxLines: 200,
    },
  },
  commands: {
    initDeep: { enabled: true },
    refactor: { enabled: true },
  },
}

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === "boolean" ? value : fallback
}

const normalizeNumber = (value: unknown, fallback: number): number => {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

const normalizeString = (value: unknown, fallback: string): string => {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback
}

const normalizeStringArray = (value: unknown, fallback: string[]): string[] => {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === "string")
    if (items.length > 0) return items
  }
  return [...fallback]
}

const normalizeProviderList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

const mergeFeatureToggle = (
  base: FeatureToggle,
  input: Partial<FeatureToggle> | undefined,
): FeatureToggle => ({
  enabled: normalizeBoolean(input?.enabled, base.enabled),
})

export const loadGroundcontrolConfig = async (configPath?: string): Promise<GroundcontrolConfig> => {
  const configDir = path.join(os.homedir(), ".config", "opencode")
  const resolvedPath = configPath ?? path.join(configDir, CONFIG_FILENAME)
  const existing = await readJsonFile<Partial<GroundcontrolConfig>>(resolvedPath)

  if (!existing) {
    await writeJsonFile(resolvedPath, DEFAULT_CONFIG)
    return { ...DEFAULT_CONFIG }
  }

  const merged: GroundcontrolConfig = {
    sessionLogPath: normalizeString(existing.sessionLogPath, DEFAULT_CONFIG.sessionLogPath),
    allowedProviders: normalizeStringArray(
      existing.allowedProviders,
      DEFAULT_CONFIG.allowedProviders,
    ),
    features: {
      backgroundAgents: {
        ...mergeFeatureToggle(
          DEFAULT_CONFIG.features.backgroundAgents,
          existing.features?.backgroundAgents,
        ),
        pollIntervalMs: normalizeNumber(
          existing.features?.backgroundAgents?.pollIntervalMs,
          DEFAULT_CONFIG.features.backgroundAgents.pollIntervalMs,
        ),
        maxPolls: normalizeNumber(
          existing.features?.backgroundAgents?.maxPolls,
          DEFAULT_CONFIG.features.backgroundAgents.maxPolls,
        ),
      },
    },
    tools: {
      astGrep: {
        ...mergeFeatureToggle(DEFAULT_CONFIG.tools.astGrep, existing.tools?.astGrep),
        maxMatches: normalizeNumber(
          existing.tools?.astGrep?.maxMatches,
          DEFAULT_CONFIG.tools.astGrep.maxMatches,
        ),
        maxOutputBytes: normalizeNumber(
          existing.tools?.astGrep?.maxOutputBytes,
          DEFAULT_CONFIG.tools.astGrep.maxOutputBytes,
        ),
        timeoutMs: normalizeNumber(
          existing.tools?.astGrep?.timeoutMs,
          DEFAULT_CONFIG.tools.astGrep.timeoutMs,
        ),
      },
      delegation: mergeFeatureToggle(DEFAULT_CONFIG.tools.delegation, existing.tools?.delegation),
    },
    hooks: {
      keywordDetector: mergeFeatureToggle(
        DEFAULT_CONFIG.hooks.keywordDetector,
        existing.hooks?.keywordDetector,
      ),
      commentChecker: {
        ...mergeFeatureToggle(DEFAULT_CONFIG.hooks.commentChecker, existing.hooks?.commentChecker),
        customPrompt: typeof existing.hooks?.commentChecker?.customPrompt === "string"
          ? existing.hooks.commentChecker.customPrompt
          : DEFAULT_CONFIG.hooks.commentChecker.customPrompt,
      },
      sessionNotification: {
        ...mergeFeatureToggle(
          DEFAULT_CONFIG.hooks.sessionNotification,
          existing.hooks?.sessionNotification,
        ),
        idleDelayMs: normalizeNumber(
          existing.hooks?.sessionNotification?.idleDelayMs,
          DEFAULT_CONFIG.hooks.sessionNotification.idleDelayMs,
        ),
        sound: normalizeBoolean(
          existing.hooks?.sessionNotification?.sound,
          DEFAULT_CONFIG.hooks.sessionNotification.sound,
        ),
      },
      taskResumeInfo: mergeFeatureToggle(
        DEFAULT_CONFIG.hooks.taskResumeInfo,
        existing.hooks?.taskResumeInfo,
      ),
      delegateTaskRetry: mergeFeatureToggle(
        DEFAULT_CONFIG.hooks.delegateTaskRetry,
        existing.hooks?.delegateTaskRetry,
      ),
      directoryAgentsInjector: {
        ...mergeFeatureToggle(
          DEFAULT_CONFIG.hooks.directoryAgentsInjector,
          existing.hooks?.directoryAgentsInjector,
        ),
        maxLines: normalizeNumber(
          existing.hooks?.directoryAgentsInjector?.maxLines,
          DEFAULT_CONFIG.hooks.directoryAgentsInjector.maxLines,
        ),
      },
    },
    commands: {
      initDeep: mergeFeatureToggle(DEFAULT_CONFIG.commands.initDeep, existing.commands?.initDeep),
      refactor: mergeFeatureToggle(DEFAULT_CONFIG.commands.refactor, existing.commands?.refactor),
    },
  }

  const shouldWrite = JSON.stringify(existing) !== JSON.stringify(merged)
  if (shouldWrite) {
    await writeJsonFile(resolvedPath, merged)
  }

  return merged
}

export const loadOpencodeConfig = async (worktree: string): Promise<Record<string, unknown>> => {
  const configDir = path.join(os.homedir(), ".config", "opencode")
  const globalConfigPath = path.join(configDir, "opencode.json")
  const projectConfigPath = path.join(worktree, "opencode.json")

  const [globalConfig, projectConfig] = await Promise.all([
    readJsonFile<Record<string, unknown>>(globalConfigPath),
    readJsonFile<Record<string, unknown>>(projectConfigPath),
  ])

  return {
    ...(globalConfig ?? {}),
    ...(projectConfig ?? {}),
  }
}

export const enforceAllowedProviders = (
  configuredProviders: unknown,
  allowedProviders: string[],
): ProviderEnforcementResult => {
  const decision = evaluateAllowedProviders(configuredProviders, allowedProviders)

  if (decision.status !== "blocked") {
    return decision
  }

  const list = decision.disallowedProviders.join(", ")
  throw new Error(
    `Groundcontrol blocked OpenCode startup: ${list} not in groundcontrol allowedProviders. ` +
      `Update ~/.config/opencode/${CONFIG_FILENAME} or opencode.json enabled_providers.`,
  )
}

export const evaluateAllowedProviders = (
  configuredProviders: unknown,
  allowedProviders: string[],
): ProviderEnforcementResult => {
  const normalizedAllowed = normalizeProviderList(allowedProviders)
  const normalizedConfigured = normalizeProviderList(configuredProviders)

  if (normalizedAllowed.length === 0) {
    return {
      status: "skipped",
      reason: "allowedProviders empty or not set",
      configuredProviders: normalizedConfigured,
      allowedProviders: normalizedAllowed,
      disallowedProviders: [],
    }
  }

  if (normalizedConfigured.length === 0) {
    return {
      status: "skipped",
      reason: "enabled_providers empty or not set",
      configuredProviders: normalizedConfigured,
      allowedProviders: normalizedAllowed,
      disallowedProviders: [],
    }
  }

  const disallowed = normalizedConfigured.filter(
    (provider) => !normalizedAllowed.includes(provider),
  )

  if (disallowed.length === 0) {
    return {
      status: "allowed",
      reason: "enabled_providers within allowedProviders",
      configuredProviders: normalizedConfigured,
      allowedProviders: normalizedAllowed,
      disallowedProviders: [],
    }
  }

  return {
    status: "blocked",
    reason: "enabled_providers contains disallowed providers",
    configuredProviders: normalizedConfigured,
    allowedProviders: normalizedAllowed,
    disallowedProviders: disallowed,
  }
}

export const resolveSessionLogPath = (value: string): string => {
  return expandHomePath(value)
}
