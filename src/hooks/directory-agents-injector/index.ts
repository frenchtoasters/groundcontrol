import fs from "node:fs/promises"
import path from "node:path"
import { AGENTS_FILENAME } from "./constants.js"

type HookInput = {
  tool?: { name?: string }
  session?: { id?: string }
  input?: Record<string, unknown>
  output?: { output?: string; error?: string | null }
}

type HookContext = {
  directory?: string
  client?: {
    app?: { log?: (message: string) => void }
  }
}

type SessionCache = Set<string>

const findAgentsFile = async (
  startDir: string,
  rootDir: string,
): Promise<{ dir: string; content: string } | undefined> => {
  let current = startDir
  while (current.startsWith(rootDir) && current !== rootDir) {
    const agentsPath = path.join(current, AGENTS_FILENAME)
    try {
      const content = await fs.readFile(agentsPath, "utf8")
      return { dir: current, content }
    } catch {
      // continue up
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return undefined
}

const truncateContent = (content: string, maxLines = 200): string => {
  const lines = content.split("\n")
  if (lines.length <= maxLines) return content
  return lines.slice(0, maxLines).join("\n") + "\n... (truncated)"
}

export const createDirectoryAgentsInjectorHook = (options?: { maxLines?: number }) => {
  const sessionCaches = new Map<string, SessionCache>()
  const maxLines = options?.maxLines ?? 200

  const getCache = (sessionId: string): SessionCache => {
    let cache = sessionCaches.get(sessionId)
    if (!cache) {
      cache = new Set()
      sessionCaches.set(sessionId, cache)
    }
    return cache
  }

  const after = async (input: HookInput, ctx?: HookContext): Promise<void> => {
    const toolName = input.tool?.name
    if (toolName !== "read") return

    const sessionId = input.session?.id
    if (!sessionId) return

    const filePath = input.input?.filePath as string | undefined
    if (!filePath) return

    if (input.output?.error) return

    const rootDir = ctx?.directory ?? process.cwd()
    const fileDir = path.dirname(path.resolve(rootDir, filePath))

    const cache = getCache(sessionId)
    if (cache.has(fileDir)) return

    const result = await findAgentsFile(fileDir, rootDir)
    if (!result) return

    cache.add(result.dir)

    const truncated = truncateContent(result.content, maxLines)
    const injection = `\n\n[Directory Context: ${result.dir}]\n${truncated}`

    if (typeof input.output?.output === "string") {
      input.output.output = `${input.output.output}${injection}`
    } else if (input.output) {
      input.output.output = injection.trim()
    }
  }

  const onEvent = async (input: { event: { type: string; properties?: { info?: { id?: string } } } }): Promise<void> => {
    const eventType = input.event.type
    if (eventType === "session.deleted" || eventType === "session.compacted") {
      const sessionId = input.event.properties?.info?.id
      if (sessionId) {
        sessionCaches.delete(sessionId)
      }
    }
  }

  return {
    "tool.execute.after": after,
    event: onEvent,
  }
}
