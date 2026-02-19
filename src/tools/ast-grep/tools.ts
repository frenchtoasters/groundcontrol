import { tool } from "@opencode-ai/plugin"
import type { GroundcontrolConfig } from "../../config.js"
import { runSg } from "./cli.js"
import { CLI_LANGUAGES } from "./constants.js"

const buildSearchResult = (result: Awaited<ReturnType<typeof runSg>>) => {
  return {
    matches: result.matches,
    truncated: result.truncated,
  }
}

export const createAstGrepTools = (config: GroundcontrolConfig): Record<string, ReturnType<typeof tool>> => {
  const toolConfig = config.tools.astGrep

  return {
    ast_grep_search: tool({
      description: "Search code patterns with AST-aware matching",
      args: {
        pattern: tool.schema.string().describe("The search pattern (AST expression)"),
        lang: tool.schema.enum([...CLI_LANGUAGES]).describe("Programming language"),
        paths: tool.schema.array(tool.schema.string()).optional().describe("Paths to search (defaults to current directory)"),
        globs: tool.schema.array(tool.schema.string()).optional().describe("File glob patterns to include"),
        context: tool.schema.number().optional().describe("Number of context lines around matches"),
      },
      execute: async (args) => {
        const result = await runSg({
          pattern: args.pattern,
          lang: args.lang,
          paths: args.paths ?? ["."],
          globs: args.globs,
          context: args.context,
          timeoutMs: toolConfig.timeoutMs,
          maxMatches: toolConfig.maxMatches,
          maxOutputBytes: toolConfig.maxOutputBytes,
        })
        return JSON.stringify(buildSearchResult(result))
      },
    }),
    ast_grep_replace: tool({
      description: "Replace code patterns with AST-aware rewriting",
      args: {
        pattern: tool.schema.string().describe("The search pattern (AST expression)"),
        lang: tool.schema.enum([...CLI_LANGUAGES]).describe("Programming language"),
        paths: tool.schema.array(tool.schema.string()).optional().describe("Paths to search (defaults to current directory)"),
        globs: tool.schema.array(tool.schema.string()).optional().describe("File glob patterns to include"),
        context: tool.schema.number().optional().describe("Number of context lines around matches"),
        rewrite: tool.schema.string().describe("The replacement pattern"),
        dryRun: tool.schema.boolean().optional().describe("Preview changes without applying them (default: true)"),
      },
      execute: async (args) => {
        const dryRun = args.dryRun !== false
        const result = await runSg({
          pattern: args.pattern,
          lang: args.lang,
          paths: args.paths ?? ["."],
          globs: args.globs,
          context: args.context,
          rewrite: args.rewrite,
          updateAll: !dryRun,
          timeoutMs: toolConfig.timeoutMs,
          maxMatches: toolConfig.maxMatches,
          maxOutputBytes: toolConfig.maxOutputBytes,
        })
        return JSON.stringify({ ...buildSearchResult(result), dryRun })
      },
    }),
  }
}