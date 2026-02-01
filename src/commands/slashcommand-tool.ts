import type { CommandDefinition } from "./index.js"

type ToolDefinition = {
  description: string
  parameters: Record<string, unknown>
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

export const createSlashCommandTool = (
  commands: Record<string, CommandDefinition>,
): ToolDefinition => {
  return {
    description: "Render a built-in slash command template",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
      },
      required: ["command"],
    },
    execute: async (input) => {
      const raw = String(input.command ?? "").trim()
      const normalized = raw.replace(/^\//, "")
      const [name, ...args] = normalized.split(/\s+/)
      const definition = commands[name]

      if (!definition) {
        return { error: `Unknown slash command: ${name}` }
      }

      const argumentsText = args.join(" ")
      const template = definition.template.replace("$ARGUMENTS", argumentsText)
      return {
        name: definition.name,
        description: definition.description,
        prompt: template,
      }
    },
  }
}
