import type { GroundcontrolConfig } from "../config.js"
import { INIT_DEEP_TEMPLATE } from "./templates/init-deep.js"
import { REFACTOR_TEMPLATE } from "./templates/refactor.js"

export type CommandDefinition = {
  name: string
  description: string
  template: string
  argumentHint?: string
}

export const loadBuiltinCommands = (config: GroundcontrolConfig): Record<string, CommandDefinition> => {
  const commands: CommandDefinition[] = []

  if (config.commands.initDeep.enabled) {
    commands.push({
      name: "init-deep",
      description: "Generate hierarchical AGENTS.md files",
      argumentHint: "[--create-new] [--max-depth=N]",
      template: INIT_DEEP_TEMPLATE,
    })
  }

  if (config.commands.refactor.enabled) {
    commands.push({
      name: "refactor",
      description: "Guide a safe, structured refactor",
      argumentHint: "<target> [--scope=file|module|project]",
      template: REFACTOR_TEMPLATE,
    })
  }

  return commands.reduce<Record<string, CommandDefinition>>((acc, command) => {
    acc[command.name] = command
    return acc
  }, {})
}
