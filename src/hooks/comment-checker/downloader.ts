import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { ensureDownloadedBinary } from "../../utils/binary-downloader.js"
import { log } from "../../utils/logger.js"

const REPO = "code-yeongyu/go-claude-code-comment-checker"
const COMMENT_CHECKER_VERSION = "0.4.1"

interface PlatformInfo {
  os: string
  arch: string
  ext: "tar.gz" | "zip"
}

const PLATFORM_MAP: Record<string, PlatformInfo> = {
  "darwin-arm64": { os: "darwin", arch: "arm64", ext: "tar.gz" },
  "darwin-x64": { os: "darwin", arch: "amd64", ext: "tar.gz" },
  "linux-arm64": { os: "linux", arch: "arm64", ext: "tar.gz" },
  "linux-x64": { os: "linux", arch: "amd64", ext: "tar.gz" },
  "win32-x64": { os: "windows", arch: "amd64", ext: "zip" },
}

const getCacheDir = (): string => {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA
    const base = localAppData || join(homedir(), "AppData", "Local")
    return join(base, "groundcontrol", "bin")
  }

  const xdgCache = process.env.XDG_CACHE_HOME
  const base = xdgCache || join(homedir(), ".cache")
  return join(base, "groundcontrol", "bin")
}

const getBinaryName = (): string => {
  return process.platform === "win32" ? "comment-checker.exe" : "comment-checker"
}

export const ensureCommentCheckerBinary = async (): Promise<string | null> => {
  const cacheDir = getCacheDir()
  const binaryName = getBinaryName()
  const binaryPath = join(cacheDir, binaryName)

  if (existsSync(binaryPath)) {
    return binaryPath
  }

  const platformKey = `${process.platform}-${process.arch}`
  const platformInfo = PLATFORM_MAP[platformKey]
  if (!platformInfo) {
    log(`[groundcontrol] comment-checker unsupported platform: ${platformKey}`)
    return null
  }

  const assetName =
    `comment-checker_v${COMMENT_CHECKER_VERSION}_${platformInfo.os}_${platformInfo.arch}.${platformInfo.ext}`
  const downloadUrl =
    `https://github.com/${REPO}/releases/download/v${COMMENT_CHECKER_VERSION}/${assetName}`

  try {
    return await ensureDownloadedBinary({
      binaryName,
      url: downloadUrl,
      cacheDir,
    })
  } catch (error) {
    log(
      `[groundcontrol] Failed to download comment-checker: ${error instanceof Error ? error.message : error}`,
    )
    return null
  }
}
