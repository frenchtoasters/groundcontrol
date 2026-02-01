import type { GroundcontrolConfig } from "../../config.js"
import { runSg } from "./cli.js"
import { CLI_LANGUAGES } from "./constants.js"

type ToolDefinition = {
  description: string
  parameters: Record<string, unknown>
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

const buildSearchResult = (result: Awaited<ReturnType<typeof runSg>>) => {
  return {
    matches: result.matches,
    truncated: result.truncated,
  }
}

export const createAstGrepTools = (config: GroundcontrolConfig): Record<string, ToolDefinition> => {
  const toolConfig = config.tools.astGrep
  const commonParams = {
    pattern: { type: "string" },
    lang: { type: "string", enum: [...CLI_LANGUAGES] },
    paths: { type: "array", items: { type: "string" } },
    globs: { type: "array", items: { type: "string" } },
    context: { type: "number" },
  }

  return {
    ast_grep_search: {
      description: "Search code patterns with AST-aware matching",
      parameters: {
        type: "object",
        properties: commonParams,
        required: ["pattern", "lang"],
      },
      execute: async (input) => {
        const result = await runSg({
          pattern: String(input.pattern),
          lang: String(input.lang),
          paths: (input.paths as string[] | undefined) ?? ["."],
          globs: input.globs as string[] | undefined,
          context: input.context as number | undefined,
          timeoutMs: toolConfig.timeoutMs,
          maxMatches: toolConfig.maxMatches,
          maxOutputBytes: toolConfig.maxOutputBytes,
        })
        return buildSearchResult(result)
      },
    },
    ast_grep_replace: {
      description: "Replace code patterns with AST-aware rewriting",
      parameters: {
        type: "object",
        properties: {
          ...commonParams,
          rewrite: { type: "string" },
          dryRun: { type: "boolean" },
        },
        required: ["pattern", "lang", "rewrite"],
      },
      execute: async (input) => {
        const dryRun = input.dryRun !== false
        const result = await runSg({
          pattern: String(input.pattern),
          lang: String(input.lang),
          paths: (input.paths as string[] | undefined) ?? ["."],
          globs: input.globs as string[] | undefined,
          context: input.context as number | undefined,
          rewrite: String(input.rewrite),
          updateAll: !dryRun,
          timeoutMs: toolConfig.timeoutMs,
          maxMatches: toolConfig.maxMatches,
          maxOutputBytes: toolConfig.maxOutputBytes,
        })
        return { ...buildSearchResult(result), dryRun }
      },
    },
  }
}
