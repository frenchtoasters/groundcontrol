import type { KeywordDetectorState } from "./types.js"
import { detectKeywords, getKeywordMessages } from "./detector.js"

type ChatMessageInput = {
  sessionID: string
  agent?: string
  model?: { providerID: string; modelID: string }
  messageID?: string
  variant?: string
}

type ChatMessageOutput = {
  message: unknown
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>
}

export const createKeywordDetectorHook = (options?: { subagentSessions?: Set<string> }) => {
  const state: KeywordDetectorState = { injected: false }
  return async (input: ChatMessageInput, output: ChatMessageOutput): Promise<void> => {
    const sessionId = input.sessionID
    if (sessionId && options?.subagentSessions?.has(sessionId)) return
    if (!output.parts || state.injected) return

    const textParts = output.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("\n")

    const keywords = detectKeywords(textParts)
    if (keywords.length === 0) return

    const message = getKeywordMessages(keywords).join("\n\n")
    if (!message) return

    output.parts.unshift({ type: "text", text: message })
    state.injected = true

    if (keywords.includes("ultrawork") && !input.variant) {
      input.variant = "max"
    }
  }
}