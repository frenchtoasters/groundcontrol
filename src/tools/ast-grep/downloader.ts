import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { ensureDownloadedBinary } from "../../utils/binary-downloader.js"
import { log } from "../../utils/logger.js"

const REPO = "ast-grep/ast-grep"
const AST_GREP_VERSION = "0.40.0"

interface PlatformInfo {
  os: string
  arch: string
  ext: "zip"
}

const PLATFORM_MAP: Record<string, PlatformInfo> = {
  "darwin-arm64": { os: "apple-darwin", arch: "aarch64", ext: "zip" },
  "darwin-x64": { os: "apple-darwin", arch: "x86_64", ext: "zip" },
  "linux-arm64": { os: "unknown-linux-gnu", arch: "aarch64", ext: "zip" },
  "linux-x64": { os: "unknown-linux-gnu", arch: "x86_64", ext: "zip" },
  "win32-x64": { os: "pc-windows-msvc", arch: "x86_64", ext: "zip" },
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
  return process.platform === "win32" ? "sg.exe" : "sg"
}

export const ensureAstGrepBinary = async (): Promise<string | null> => {
  const cacheDir = getCacheDir()
  const binaryName = getBinaryName()
  const binaryPath = join(cacheDir, binaryName)

  if (existsSync(binaryPath)) {
    return binaryPath
  }

  const platformKey = `${process.platform}-${process.arch}`
  const platformInfo = PLATFORM_MAP[platformKey]
  if (!platformInfo) {
    log(`[groundcontrol] ast-grep unsupported platform: ${platformKey}`)
    return null
  }

  const assetName = `app-${platformInfo.arch}-${platformInfo.os}.${platformInfo.ext}`
  const downloadUrl = `https://github.com/${REPO}/releases/download/${AST_GREP_VERSION}/${assetName}`

  try {
    return await ensureDownloadedBinary({
      binaryName,
      url: downloadUrl,
      cacheDir,
    })
  } catch (error) {
    log(`[groundcontrol] Failed to download ast-grep: ${error instanceof Error ? error.message : error}`)
    return null
  }
}
