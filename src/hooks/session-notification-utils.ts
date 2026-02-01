import { spawnWithTimeout } from "../utils/spawn.js"

const commandCache = new Map<string, string | null>()

const findCommand = async (command: string): Promise<string | null> => {
  if (commandCache.has(command)) return commandCache.get(command) ?? null
  const lookup = process.platform === "win32" ? "where" : "which"
  try {
    const result = await spawnWithTimeout(lookup, [command], { timeoutMs: 2000 })
    const output = result.stdout.trim()
    const resolved = output.split(/\r?\n/)[0]
    const value = resolved ? resolved : null
    commandCache.set(command, value)
    return value
  } catch {
    commandCache.set(command, null)
    return null
  }
}

export const getNotifySendPath = () => findCommand("notify-send")
export const getOsascriptPath = () => findCommand("osascript")
export const getPowershellPath = () => findCommand("powershell")
export const getAfplayPath = () => findCommand("afplay")
export const getPaplayPath = () => findCommand("paplay")
export const getAplayPath = () => findCommand("aplay")
