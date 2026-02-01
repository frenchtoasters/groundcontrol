import type { KeywordDetectorState } from "./types.js"
import { detectKeywords, getKeywordMessages } from "./detector.js"

type HookInput = {
  message?: { parts?: Array<{ type?: string; text?: string }>; variant?: string }
  session?: { id?: string }
}

type HookContext = {
  client: {
    app?: { toast?: (message: string) => void }
  }
}

export const createKeywordDetectorHook = (options?: { subagentSessions?: Set<string> }) => {
  const state: KeywordDetectorState = { injected: false }
  return async (input: HookInput, ctx?: HookContext): Promise<void> => {
    const sessionId = input.session?.id
    if (sessionId && options?.subagentSessions?.has(sessionId)) return
    if (!input.message?.parts || state.injected) return

    const textParts = input.message.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("\n")

    const keywords = detectKeywords(textParts)
    if (keywords.length === 0) return

    const message = getKeywordMessages(keywords).join("\n\n")
    if (!message) return

    input.message.parts.unshift({ type: "text", text: message })
    state.injected = true

    if (keywords.includes("ultrawork") && !input.message.variant) {
      input.message.variant = "max"
    }

    ctx?.client.app?.toast?.("Groundcontrol: keyword detector injected guidance")
  }
}
