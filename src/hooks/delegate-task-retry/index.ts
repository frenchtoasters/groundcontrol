const ERROR_PATTERNS = [
  "Missing required",
  "Invalid argument",
  "Invalid arguments",
  "Expected object",
  "Failed to parse",
]

const detectDelegateTaskError = (output?: string): string | undefined => {
  if (!output) return undefined
  const match = ERROR_PATTERNS.find((pattern) => output.includes(pattern))
  return match
}

const buildRetryGuidance = (): string => {
  return [
    "[delegate-task-retry]",
    "If this failed due to args, retry with:",
    "- load_skills: array of skill names",
    "- description: short summary",
    "- prompt: task prompt",
    "- run_in_background: true | false",
    "- optional: subagent_type or category",
  ].join("\n")
}

export const createDelegateTaskRetryHook = () => {
  return {
    "tool.execute.after": async (
      input: { tool?: string },
      output: { output?: string },
    ): Promise<void> => {
      if (input.tool !== "delegate_task") return
      const error = detectDelegateTaskError(output.output)
      if (!error) return
      const guidance = buildRetryGuidance()
      output.output = output.output ? `${output.output}\n\n${guidance}` : guidance
    },
  }
}
