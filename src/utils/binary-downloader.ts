import fs from "node:fs"
import fsPromises from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createWriteStream } from "node:fs"
import { pipeline } from "node:stream/promises"
import tar from "tar"
import unzipper from "unzipper"

export type BinaryDownloadOptions = {
  binaryName: string
  url: string
  cacheDir?: string
}

const DEFAULT_CACHE_DIR = path.join(os.homedir(), ".cache", "groundcontrol", "bin")

const ensureExecutable = async (filePath: string): Promise<void> => {
  if (process.platform === "win32") return
  await fsPromises.chmod(filePath, 0o755)
}

const downloadFile = async (url: string, destination: string): Promise<void> => {
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  await fsPromises.mkdir(path.dirname(destination), { recursive: true })
  const stream = createWriteStream(destination)
  await pipeline(response.body, stream)
}

const extractArchive = async (
  archivePath: string,
  destinationDir: string,
): Promise<void> => {
  await fsPromises.mkdir(destinationDir, { recursive: true })
  if (archivePath.endsWith(".zip")) {
    await fs.createReadStream(archivePath).pipe(unzipper.Extract({ path: destinationDir })).promise()
    return
  }
  if (archivePath.endsWith(".tar.gz") || archivePath.endsWith(".tgz")) {
    await tar.x({ file: archivePath, cwd: destinationDir })
    return
  }
  throw new Error(`Unsupported archive format: ${archivePath}`)
}

const findBinary = async (directory: string, binaryName: string): Promise<string> => {
  const entries = await fsPromises.readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      const nested = await findBinary(entryPath, binaryName)
      if (nested) return nested
    } else if (entry.name === binaryName) {
      return entryPath
    }
  }
  return ""
}

export const ensureDownloadedBinary = async (
  options: BinaryDownloadOptions,
): Promise<string> => {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR
  const cachedPath = path.join(cacheDir, options.binaryName)
  try {
    await fsPromises.access(cachedPath)
    return cachedPath
  } catch {
    // continue
  }

  const downloadDir = path.join(cacheDir, ".downloads")
  const archivePath = path.join(downloadDir, path.basename(options.url))
  await downloadFile(options.url, archivePath)

  const extractDir = path.join(downloadDir, `extract-${Date.now()}`)
  await extractArchive(archivePath, extractDir)
  const binaryPath = await findBinary(extractDir, options.binaryName)
  if (!binaryPath) {
    throw new Error(`Binary ${options.binaryName} not found in archive`)
  }

  await fsPromises.mkdir(cacheDir, { recursive: true })
  await fsPromises.copyFile(binaryPath, cachedPath)
  await ensureExecutable(cachedPath)
  return cachedPath
}
