import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

type GroundcontrolConfig = {
  sessionLogPath: string
  allowedProviders: string[]
}

type PluginContext = {
  client: {
    app: {
      log: (args: {
        body: {
          service: string
          level: "debug" | "info" | "warn" | "error"
          message: string
          extra?: Record<string, unknown>
        }
      }) => Promise<unknown>
    }
    session: {
      messages: (args: { path: { id: string } }) => Promise<unknown>
    }
  }
  worktree?: string
}

const SERVICE_NAME = "groundcontrol"
const CONFIG_FILENAME = "groundcontrol.json"
const DEFAULT_CONFIG: GroundcontrolConfig = {
  sessionLogPath: "~/.opencode/groundcontrol-sessions/",
  allowedProviders: ["amazon-bedrock", "openai"],
}

const normalizeSessionLogPath = (value: unknown): string => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value
  }
  return DEFAULT_CONFIG.sessionLogPath
}

const normalizeAllowedProviders = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const providers = value.filter((item): item is string => typeof item === "string")
    if (providers.length > 0) {
      return providers
    }
  }
  return [...DEFAULT_CONFIG.allowedProviders]
}

const expandHomePath = (inputPath: string): string => {
  if (inputPath === "~") {
    return os.homedir()
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2))
  }
  return inputPath
}

const ensureDirectory = async (directoryPath: string): Promise<void> => {
  await fs.mkdir(directoryPath, { recursive: true })
}

const readJsonFile = async <T>(filePath: string): Promise<T | undefined> => {
  try {
    const contents = await fs.readFile(filePath, "utf8")
    return JSON.parse(contents) as T
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined
      }
    }
    throw error
  }
}

const writeJsonFile = async (filePath: string, data: unknown): Promise<void> => {
  await ensureDirectory(path.dirname(filePath))
  const contents = `${JSON.stringify(data, null, 2)}\n`
  await fs.writeFile(filePath, contents, "utf8")
}

const loadGroundcontrolConfig = async (configPath: string): Promise<GroundcontrolConfig> => {
  const existing = await readJsonFile<Partial<GroundcontrolConfig>>(configPath)
  if (!existing) {
    await writeJsonFile(configPath, DEFAULT_CONFIG)
    return { ...DEFAULT_CONFIG }
  }

  const merged: GroundcontrolConfig = {
    sessionLogPath: normalizeSessionLogPath(existing.sessionLogPath),
    allowedProviders: normalizeAllowedProviders(existing.allowedProviders),
  }

  const shouldWrite =
    existing.sessionLogPath !== merged.sessionLogPath ||
    JSON.stringify(existing.allowedProviders ?? []) !== JSON.stringify(merged.allowedProviders)

  if (shouldWrite) {
    await writeJsonFile(configPath, merged)
  }

  return merged
}

const loadOpencodeConfig = async (worktree: string): Promise<Record<string, unknown>> => {
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

const enforceAllowedProviders = (
  configuredProviders: unknown,
  allowedProviders: string[],
): void => {
  if (!Array.isArray(configuredProviders)) {
    return
  }

  const disallowed = configuredProviders.filter(
    (provider): provider is string =>
      typeof provider === "string" && !allowedProviders.includes(provider),
  )

  if (disallowed.length === 0) {
    return
  }

  const list = disallowed.join(", ")
  throw new Error(
    `Groundcontrol blocked OpenCode startup: ${list} not in groundcontrol allowedProviders. ` +
      `Update ~/.config/opencode/${CONFIG_FILENAME} or opencode.json allowed-providers.`,
  )
}

const toTitleCase = (value: string): string => {
  if (value.length === 0) {
    return value
  }
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

const resolveSessionId = (input: Record<string, unknown>): string | undefined => {
  const session = input.session as { id?: string } | undefined
  return (
    session?.id ||
    (input.sessionId as string | undefined) ||
    (input.session_id as string | undefined) ||
    (input.id as string | undefined)
  )
}

const renderSessionMarkdown = async (client: PluginContext["client"], sessionId: string): Promise<string> => {
  const response = await client.session.messages({ path: { id: sessionId } })
  const entries = (response as { data?: unknown }).data ?? response

  if (!Array.isArray(entries)) {
    return ""
  }

  const lines: string[] = []

  for (const entry of entries) {
    const info = (entry as { info?: { role?: string; type?: string } }).info
    const role = info?.role ?? info?.type ?? "assistant"
    const parts = (entry as { parts?: Array<{ type?: string; text?: string }> }).parts ?? []
    const textParts = parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text?.trim())
      .filter((text): text is string => Boolean(text))

    lines.push(`## ${toTitleCase(role)}`)
    if (textParts.length > 0) {
      lines.push(textParts.join("\n\n"))
    }
    lines.push("")
  }

  return `${lines.join("\n")}\n`
}

export const Groundcontrol = async ({ client, worktree }: PluginContext) => {
  const configDir = path.join(os.homedir(), ".config", "opencode")
  const configPath = path.join(configDir, CONFIG_FILENAME)
  const config = await loadGroundcontrolConfig(configPath)

  await client.app.log({
    body: {
      service: SERVICE_NAME,
      level: "info",
      message: "Groundcontrol plugin initialized",
      extra: { configPath },
    },
  })

  const opencodeConfig = await loadOpencodeConfig(worktree ?? process.cwd())
  enforceAllowedProviders(opencodeConfig["allowed-providers"], config.allowedProviders)

  const sessionLogPath = expandHomePath(config.sessionLogPath)
  await ensureDirectory(sessionLogPath)

  const saveSession = async (input: Record<string, unknown>) => {
    const sessionId = resolveSessionId(input)
    if (!sessionId) {
      return
    }

    try {
      const markdown = await renderSessionMarkdown(client, sessionId)
      const outputPath = path.join(sessionLogPath, `${sessionId}.md`)
      await fs.writeFile(outputPath, markdown, "utf8")
    } catch (error) {
      await client.app.log({
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
    "session.idle": async (input: Record<string, unknown>) => {
      await saveSession(input)
    },
    "session.updated": async (input: Record<string, unknown>) => {
      await saveSession(input)
    },
  } as Record<string, unknown>
}
