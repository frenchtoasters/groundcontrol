export type BackgroundTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled"

export type BackgroundTask = {
  id: string
  description: string
  prompt: string
  agent: string
  parentSessionId?: string
  parentMessageId?: string
  sessionId?: string
  status: BackgroundTaskStatus
  createdAt: number
  startedAt?: number
  completedAt?: number
  error?: string
  lastMessageCount: number
}

export type BackgroundLaunchInput = {
  description: string
  prompt: string
  agent: string
  parentSessionId?: string
  parentMessageId?: string
}

export type BackgroundOutputResult = {
  status: BackgroundTaskStatus
  output?: string
  error?: string
}
