import { spawnWithTimeout } from "../../utils/spawn.js"
import { ensureAstGrepBinary } from "./downloader.js"
import type { SgMatch, SgResult } from "./types.js"

type RunSgOptions = {
  pattern: string
  lang: string
  paths?: string[]
  globs?: string[]
  context?: number
  rewrite?: string
  updateAll?: boolean
  timeoutMs: number
  maxMatches: number
  maxOutputBytes: number
}

let cachedPath: string | null = null

const getAstGrepPath = async (): Promise<string | null> => {
  if (cachedPath) return cachedPath
  cachedPath = await ensureAstGrepBinary()
  return cachedPath
}

const parseMatches = (output: string, maxMatches: number): { matches: SgMatch[]; truncated: boolean } => {
  const lines = output.split("\n").filter(Boolean)
  const matches: SgMatch[] = []
  let truncated = false

  for (const line of lines) {
    if (matches.length >= maxMatches) {
      truncated = true
      break
    }
    try {
      const payload = JSON.parse(line) as Record<string, unknown>
      const file =
        (payload.file as string | undefined) ||
        (payload.path as string | undefined) ||
        (payload.filename as string | undefined)
      const lineNumber =
        (payload.line as number | undefined) ||
        (payload.line_number as number | undefined) ||
        (payload.start as { line?: number } | undefined)?.line ||
        0
      const column =
        (payload.column as number | undefined) ||
        (payload.col as number | undefined) ||
        (payload.start as { column?: number } | undefined)?.column ||
        0
      const text =
        (payload.text as string | undefined) ||
        (payload.match as string | undefined) ||
        (payload.lines as string | undefined) ||
        line
      matches.push({ file: file ?? "", line: lineNumber, column, text })
    } catch {
      matches.push({ file: "", line: 0, column: 0, text: line })
    }
  }

  return { matches, truncated }
}

export const runSg = async (options: RunSgOptions): Promise<SgResult> => {
  const binaryPath = await getAstGrepPath()
  if (!binaryPath) {
    throw new Error("ast-grep CLI is unavailable on this system")
  }

  const args = [
    "run",
    "-p",
    options.pattern,
    "--lang",
    options.lang,
    "--json=compact",
  ]

  if (options.context && options.context > 0) {
    args.push("-C", String(options.context))
  }
  if (options.rewrite) {
    args.push("-r", options.rewrite)
  }
  if (options.updateAll) {
    args.push("--update-all")
  }
  if (options.globs && options.globs.length > 0) {
    for (const glob of options.globs) {
      args.push("--globs", glob)
    }
  }

  if (options.paths && options.paths.length > 0) {
    args.push(...options.paths)
  }

  const result = await spawnWithTimeout(binaryPath, args, { timeoutMs: options.timeoutMs })
  const stdout = result.stdout.slice(0, options.maxOutputBytes)
  const truncatedOutput = result.stdout.length > options.maxOutputBytes

  const parsed = parseMatches(stdout, options.maxMatches)
  return {
    matches: parsed.matches,
    truncated: parsed.truncated || truncatedOutput,
    rawOutput: stdout,
  }
}
