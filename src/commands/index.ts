import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
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

/**
 * Write command markdown files to ~/.config/opencode/commands/
 * This is the documented mechanism for registering slash commands with OpenCode.
 * Each command becomes a markdown file with YAML frontmatter.
 */
export const writeCommandFiles = async (
  commands: Record<string, CommandDefinition>,
): Promise<void> => {
  const commandsDir = path.join(os.homedir(), ".config", "opencode", "commands")
  await fs.mkdir(commandsDir, { recursive: true })

  for (const [name, command] of Object.entries(commands)) {
    const frontmatter = [
      "---",
      `description: ${command.description}`,
    ]
    if (command.argumentHint) {
      frontmatter.push(`argument-hint: "${command.argumentHint}"`)
    }
    frontmatter.push("---")

    const content = `${frontmatter.join("\n")}\n\n${command.template}\n`
    const filePath = path.join(commandsDir, `${name}.md`)
    await fs.writeFile(filePath, content, "utf-8")
  }
}
