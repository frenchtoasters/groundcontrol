import type { GroundcontrolConfig } from "../config.js"
import { extractTextParts } from "../utils/session.js"
import type { BackgroundLaunchInput, BackgroundOutputResult, BackgroundTask } from "./types.js"

type PluginClient = {
  session: {
    create: (input: unknown) => Promise<unknown>
    prompt: (input: unknown) => Promise<unknown>
    messages: (input: unknown) => Promise<unknown>
    status?: (input: unknown) => Promise<unknown>
    abort?: (input: unknown) => Promise<unknown>
  }
}

const resolveSessionId = (response: unknown): string | undefined => {
  if (response && typeof response === "object") {
    const asRecord = response as Record<string, unknown>
    const data = asRecord.data as Record<string, unknown> | undefined
    return (
      (data?.id as string | undefined) ||
      (asRecord.id as string | undefined) ||
      (asRecord.sessionId as string | undefined)
    )
  }
  return undefined
}

const formatMessages = (
  messages: Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>,
): string => {
  const lines: string[] = []
  for (const message of messages) {
    const role = message.info?.role ?? "assistant"
    const textParts = extractTextParts(message)
    if (textParts.length > 0) {
      lines.push(`## ${role}`)
      lines.push(textParts.join("\n\n"))
    }
  }
  return lines.join("\n\n")
}

export class BackgroundTaskManager {
  private tasks = new Map<string, BackgroundTask>()
  private pollIntervalMs: number
  private maxPolls: number
  private subagentSessions = new Set<string>()

  constructor(
    private client: PluginClient,
    config: GroundcontrolConfig,
  ) {
    this.pollIntervalMs = config.features.backgroundAgents.pollIntervalMs
    this.maxPolls = config.features.backgroundAgents.maxPolls
  }

  get(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId)
  }

  getSubagentSessions(): Set<string> {
    return this.subagentSessions
  }

  async launch(input: BackgroundLaunchInput): Promise<BackgroundTask> {
    const id = `bg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const task: BackgroundTask = {
      id,
      description: input.description,
      prompt: input.prompt,
      agent: input.agent,
      parentSessionId: input.parentSessionId,
      parentMessageId: input.parentMessageId,
      status: "pending",
      createdAt: Date.now(),
      lastMessageCount: 0,
    }
    this.tasks.set(task.id, task)
    void this.runTask(task)
    return task
  }

  async resume(taskId: string, prompt: string): Promise<BackgroundTask | undefined> {
    const task = this.tasks.get(taskId)
    if (!task || !task.sessionId) return undefined
    task.prompt = prompt
    task.status = "running"
    task.startedAt = Date.now()
    this.subagentSessions.add(task.sessionId)
    await this.client.session.prompt({ path: { id: task.sessionId }, body: { content: prompt, agent: task.agent } })
    void this.pollTask(task)
    return task
  }

  async cancel(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId)
    if (!task) return false
    task.status = "cancelled"
    if (task.sessionId && this.client.session.abort) {
      await this.client.session.abort({ path: { id: task.sessionId } })
    }
    return true
  }

  async consumeNewMessages(task: BackgroundTask): Promise<string | undefined> {
    if (!task.sessionId) return undefined
    const response = await this.client.session.messages({ path: { id: task.sessionId } })
    const messages = (response as { data?: Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }> }).data ?? []
    if (messages.length <= task.lastMessageCount) {
      return undefined
    }
    const newMessages = messages.slice(task.lastMessageCount)
    task.lastMessageCount = messages.length
    return formatMessages(newMessages)
  }

  async getResult(taskId: string): Promise<BackgroundOutputResult> {
    const task = this.tasks.get(taskId)
    if (!task) {
      return { status: "failed", error: `Unknown task ${taskId}` }
    }

    const output = await this.consumeNewMessages(task)
    return { status: task.status, output, error: task.error }
  }

  private async runTask(task: BackgroundTask): Promise<void> {
    try {
      task.status = "running"
      task.startedAt = Date.now()
      const response = await this.client.session.create({ body: { parentID: task.parentSessionId } })
      task.sessionId = resolveSessionId(response)
      if (!task.sessionId) {
        throw new Error("Failed to create background session")
      }
      this.subagentSessions.add(task.sessionId)
      await this.client.session.prompt({
        path: { id: task.sessionId },
        body: { content: task.prompt, agent: task.agent },
      })
      await this.pollTask(task)
    } catch (error) {
      task.status = "failed"
      task.error = error instanceof Error ? error.message : String(error)
      task.completedAt = Date.now()
    }
  }

  private async pollTask(task: BackgroundTask): Promise<void> {
    for (let poll = 0; poll < this.maxPolls; poll += 1) {
      if (task.status !== "running") return
      const isIdle = await this.isSessionIdle(task.sessionId)
      if (isIdle) {
        task.status = "completed"
        task.completedAt = Date.now()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs))
    }
    task.status = "completed"
    task.completedAt = Date.now()
  }

  private async isSessionIdle(sessionId?: string): Promise<boolean> {
    if (!sessionId) return false
    if (this.client.session.status) {
      const response = await this.client.session.status({ path: { id: sessionId } })
      const status = (response as { data?: { status?: string } }).data?.status
      if (status) {
        return ["idle", "completed", "done"].includes(status)
      }
    }
    return false
  }
}
