import { spawnWithTimeout } from "../../utils/spawn.js"
import { ensureCommentCheckerBinary } from "./downloader.js"
import type { CommentCheckerResult } from "./types.js"

let cachedPath: string | null = null

const getCommentCheckerPath = async (): Promise<string | null> => {
  if (cachedPath) return cachedPath
  cachedPath = await ensureCommentCheckerBinary()
  return cachedPath
}

export const isCliAvailable = async (): Promise<boolean> => {
  const path = await getCommentCheckerPath()
  return Boolean(path)
}

export const startBackgroundInit = (): void => {
  void getCommentCheckerPath()
}

export const runCommentChecker = async (
  payload: Record<string, unknown>,
): Promise<CommentCheckerResult> => {
  const path = await getCommentCheckerPath()
  if (!path) {
    return { hasComments: false }
  }

  const { stdout, stderr, exitCode } = await spawnWithTimeout(path, [], {
    input: JSON.stringify(payload),
    timeoutMs: 30_000,
  })

  if (exitCode === 2) {
    return { hasComments: true, message: stdout.trim() || stderr.trim() }
  }

  return { hasComments: false, message: stdout.trim() || stderr.trim() }
}
