import { spawn } from "node:child_process"

export type SpawnResult = {
  stdout: string
  stderr: string
  exitCode: number | null
  signal: NodeJS.Signals | null
}

export const spawnWithTimeout = (
  command: string,
  args: string[],
  options: { cwd?: string; input?: string; timeoutMs?: number } = {},
): Promise<SpawnResult> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "pipe",
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let timedOut = false
    let timeoutId: NodeJS.Timeout | undefined

    if (options.input) {
      child.stdin.write(options.input)
      child.stdin.end()
    }

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true
        child.kill("SIGKILL")
      }, options.timeoutMs)
    }

    child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)))
    child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)))

    child.on("error", (error) => {
      if (timeoutId) clearTimeout(timeoutId)
      reject(error)
    })

    child.on("close", (code, signal) => {
      if (timeoutId) clearTimeout(timeoutId)
      if (timedOut) {
        resolve({ stdout: "", stderr: "", exitCode: code, signal })
        return
      }
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf8"),
        stderr: Buffer.concat(stderrChunks).toString("utf8"),
        exitCode: code,
        signal,
      })
    })
  })
}
