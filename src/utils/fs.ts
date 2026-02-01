import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

export const expandHomePath = (inputPath: string): string => {
  if (inputPath === "~") {
    return os.homedir()
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2))
  }
  return inputPath
}

export const ensureDirectory = async (directoryPath: string): Promise<void> => {
  await fs.mkdir(directoryPath, { recursive: true })
}

export const readJsonFile = async <T>(filePath: string): Promise<T | undefined> => {
  try {
    const contents = await fs.readFile(filePath, "utf8")
    return JSON.parse(contents) as T
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined
      }
    }
    throw error
  }
}

export const writeJsonFile = async (filePath: string, data: unknown): Promise<void> => {
  await ensureDirectory(path.dirname(filePath))
  const contents = `${JSON.stringify(data, null, 2)}\n`
  await fs.writeFile(filePath, contents, "utf8")
}
