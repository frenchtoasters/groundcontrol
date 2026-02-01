import type { CommentCheckerResult, PendingCall } from "./types.js"
import { runCommentChecker, startBackgroundInit, isCliAvailable } from "./cli.js"

type HookContext = {
  client: {
    app?: { log?: (message: string) => void }
  }
}

type HookInput = {
  tool?: { name?: string }
  session?: { id?: string }
  input?: Record<string, unknown>
  output?: { output?: string; error?: string | null }
}

const TOOL_NAMES = new Set(["write", "edit", "multiedit"])

export const createCommentCheckerHooks = (options?: { customPrompt?: string }) => {
  const pendingCalls = new Map<string, PendingCall>()
  startBackgroundInit()

  const before = async (input: HookInput): Promise<void> => {
    const toolName = input.tool?.name
    const sessionId = input.session?.id
    if (!toolName || !sessionId || !TOOL_NAMES.has(toolName)) return

    const payload = input.input ?? {}
    pendingCalls.set(sessionId, {
      filePath: payload.filePath as string | undefined,
      content: payload.content as string | undefined,
      oldString: payload.oldString as string | undefined,
      newString: payload.newString as string | undefined,
      edits: payload.edits as Array<{ oldString?: string; newString?: string }> | undefined,
      tool: toolName,
      sessionId,
      timestamp: Date.now(),
    })
  }

  const after = async (input: HookInput, ctx?: HookContext): Promise<void> => {
    const sessionId = input.session?.id
    if (!sessionId) return
    const pending = pendingCalls.get(sessionId)
    if (!pending) return
    pendingCalls.delete(sessionId)

    if (input.output?.error) return
    if (!(await isCliAvailable())) return

    const payload = {
      filePath: pending.filePath,
      content: pending.content,
      oldString: pending.oldString,
      newString: pending.newString,
      edits: pending.edits,
      tool: pending.tool,
      customPrompt: options?.customPrompt,
    }

    let result: CommentCheckerResult
    try {
      result = await runCommentChecker(payload)
    } catch (error) {
      ctx?.client.app?.log?.(
        `[groundcontrol] comment-checker failed: ${error instanceof Error ? error.message : error}`,
      )
      return
    }

    if (result.hasComments && result.message) {
      const message = `\n\n[comment-checker]\n${result.message}`
      if (typeof input.output?.output === "string") {
        input.output.output = `${input.output.output}${message}`
      } else if (input.output) {
        input.output.output = message.trim()
      }
    }
  }

  return {
    "tool.execute.before": before,
    "tool.execute.after": after,
  }
}
