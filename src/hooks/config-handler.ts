import type { GroundcontrolConfig } from "../config.js"
import { loadBuiltinCommands } from "../commands/index.js"

export const createConfigHook = (pluginConfig: GroundcontrolConfig) => {
  return async (input: Record<string, unknown>): Promise<void> => {
    const commands = loadBuiltinCommands(pluginConfig)

    const existingCommands = (input.command as Record<string, unknown>) ?? {}

    const injectedCommands: Record<string, { template: string; description?: string }> = {}

    for (const [key, value] of Object.entries(commands)) {
      injectedCommands[key] = {
        template: value.template,
        description: value.description,
      }
    }

    input.command = {
      ...existingCommands,
      ...injectedCommands,
    }
  }
}