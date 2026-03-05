import fs from "node:fs/promises"
import path from "node:path"
import { formatMessageLines, getSessionStatusData } from "../utils/session.js"

type PluginClient = {
  session: {
    messages: (input: { path: { id: string } }) => Promise<unknown>
    status?: (input: { path: { id: string } }) => Promise<unknown>
  }
  app: {
    log?: (input: { body: Record<string, unknown> }) => void
  }
}

interface SessionSaverOptions {
  sessionLogPath: string
  client: PluginClient
}

const renderMessages = (entries: unknown[], startIndex = 0): string => {
  const lines: string[] = []
  for (let i = startIndex; i < entries.length; i++) {
    lines.push(formatMessageLines(entries[i] as { info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }))
    lines.push("")
  }
  return lines.join("\n")
}

export const createSessionSaverHook = (options: SessionSaverOptions) => {
  const { sessionLogPath, client } = options
  const lastSavedCount = new Map<string, number>()

  return async (input: {
    event: {
      type: string
      properties?: {
        sessionID?: string
        info?: {
          id?: string
          title?: string
          parentID?: string
        }
      }
    }
  }): Promise<void> => {
    if (input.event.type !== "session.idle") {
      return
    }

    const sessionId = input.event.properties?.sessionID ?? input.event.properties?.info?.id
    if (!sessionId) {
      return
    }

    // Check if it's a child session using the API if it's not present in the payload
    let isChild = Boolean(input.event.properties?.info?.parentID)
    if (!isChild) {
      const statusData = await getSessionStatusData(client, sessionId)
      if (statusData?.parentID) {
        isChild = true
      }
    }

    if (isChild) {
      return
    }

    try {
      const messagesResponse = await client.session.messages({ path: { id: sessionId } })
      const entries = ((messagesResponse as { data?: unknown[] })?.data ?? messagesResponse) as unknown[]
      if (!Array.isArray(entries)) return

      const lastCount = lastSavedCount.get(sessionId) ?? 0
      if (entries.length <= lastCount) {
        return
      }

      const filePath = path.join(sessionLogPath, `${sessionId}.md`)
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false)

      if (!fileExists) {
        const content = renderMessages(entries, 0)
        await fs.writeFile(filePath, content, "utf-8")
      } else {
        const separator = `\n---\n\n## Session Resumed — ${new Date().toISOString()}\n\n`
        const content = separator + renderMessages(entries, lastCount)
        await fs.appendFile(filePath, content, "utf-8")
      }
      lastSavedCount.set(sessionId, entries.length)
    } catch (error) {
      client.app.log?.({ body: { error, sessionId } })
    }
  }
}