import { spawnWithTimeout } from "../utils/spawn.js"
import {
  getNotifySendPath,
  getOsascriptPath,
  getPowershellPath,
  getAfplayPath,
  getPaplayPath,
  getAplayPath,
} from "./session-notification-utils.js"

type EventInput = {
  event: {
    type: string
    properties?: { info?: { id?: string; title?: string; parentID?: string } }
  }
}

type NotificationConfig = {
  idleDelayMs: number
  sound: boolean
}

const NOTIFY_TIMEOUT_MS = 5_000
const SOUND_TIMEOUT_MS = 5_000

const notify = async (title: string, message: string): Promise<void> => {
  if (process.platform === "darwin") {
    const osascript = await getOsascriptPath()
    if (!osascript) return
    await spawnWithTimeout(osascript, [
      "-e",
      `display notification \"${message.replace(/"/g, "\\\"")}\" with title \"${title.replace(/"/g, "\\\"")}\"`,
    ], {
      timeoutMs: NOTIFY_TIMEOUT_MS,
    })
    return
  }

  if (process.platform === "win32") {
    const powershell = await getPowershellPath()
    if (!powershell) return
    await spawnWithTimeout(powershell, [
      "-Command",
      `New-BurntToastNotification -Text '${title.replace(/'/g, "''")}', '${message.replace(/'/g, "''")}'`,
    ], {
      timeoutMs: NOTIFY_TIMEOUT_MS,
    })
    return
  }

  const notifySend = await getNotifySendPath()
  if (notifySend) {
    await spawnWithTimeout(notifySend, [title, message], {
      timeoutMs: NOTIFY_TIMEOUT_MS,
    })
  }
}

const playSound = async (): Promise<void> => {
  const afplay = await getAfplayPath()
  if (afplay) {
    await spawnWithTimeout(afplay, ["/System/Library/Sounds/Glass.aiff"], {
      timeoutMs: SOUND_TIMEOUT_MS,
    })
    return
  }
  const paplay = await getPaplayPath()
  if (paplay) {
    await spawnWithTimeout(paplay, ["/usr/share/sounds/freedesktop/stereo/complete.oga"], {
      timeoutMs: SOUND_TIMEOUT_MS,
    })
    return
  }
  const aplay = await getAplayPath()
  if (aplay) {
    await spawnWithTimeout(aplay, ["/usr/share/sounds/alsa/Front_Center.wav"], {
      timeoutMs: SOUND_TIMEOUT_MS,
    })
  }
}

export const createSessionNotification = (config: NotificationConfig) => {
  const timers = new Map<string, NodeJS.Timeout>()

  const clearTimer = (sessionId?: string) => {
    if (!sessionId) return
    const timer = timers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      timers.delete(sessionId)
    }
  }

  return async (input: EventInput): Promise<void> => {
    const { event } = input
    const info = event.properties?.info
    const sessionId = info?.id

    if (!sessionId) return
    if (info?.parentID) return

    if (event.type === "session.updated" || event.type === "message.updated") {
      clearTimer(sessionId)
      return
    }

    if (event.type !== "session.idle") return

    clearTimer(sessionId)
    const timer = setTimeout(async () => {
      await notify("OpenCode", `Session ${sessionId} is idle`) 
      if (config.sound) {
        await playSound()
      }
    }, config.idleDelayMs)

    timers.set(sessionId, timer)
  }
}
