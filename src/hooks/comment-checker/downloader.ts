import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { createRequire } from "node:module"
import { ensureDownloadedBinary } from "../../utils/binary-downloader.js"
import { log } from "../../utils/logger.js"

const REPO = "code-yeongyu/go-claude-code-comment-checker"

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

const getPackageVersion = (): string => {
  try {
    const require = createRequire(import.meta.url)
    const pkg = require("@code-yeongyu/comment-checker/package.json")
    return pkg.version
  } catch {
    return "0.4.1"
  }
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

  const version = getPackageVersion()
  const assetName = `comment-checker_v${version}_${platformInfo.os}_${platformInfo.arch}.${platformInfo.ext}`
  const downloadUrl = `https://github.com/${REPO}/releases/download/v${version}/${assetName}`

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
