const SESSION_ID_PATTERNS = [
  /session_id\s*[:=]\s*"([^"]+)"/i,
  /sessionID\s*[:=]\s*"([^"]+)"/i,
  /sessionId\s*[:=]\s*"([^"]+)"/i,
]

const extractSessionId = (output?: string): string | undefined => {
  if (!output) return undefined
  for (const pattern of SESSION_ID_PATTERNS) {
    const match = output.match(pattern)
    if (match?.[1]) return match[1]
  }
  return undefined
}

export const createTaskResumeInfoHook = () => {
  return {
    "tool.execute.after": async (
      input: { tool?: string },
      output: { output?: string },
    ): Promise<void> => {
      const toolName = input.tool ?? ""
      if (!["delegate_task", "task", "Task", "call_omo_agent"].includes(toolName)) return
      if (output.output?.includes("to continue")) return
      const sessionId = extractSessionId(output.output)
      if (!sessionId) return
      const resumeHint = `\n\nTo continue: delegate_task({ session_id: "${sessionId}", prompt: "Continue" })`
      output.output = output.output ? `${output.output}${resumeHint}` : resumeHint.trim()
    },
  }
}
