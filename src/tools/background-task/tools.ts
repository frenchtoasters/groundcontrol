import type { BackgroundTaskManager } from "../../background/manager.js"

type ToolDefinition = {
  description: string
  parameters: Record<string, unknown>
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

export const createBackgroundTaskTool = (manager: BackgroundTaskManager): ToolDefinition => {
  return {
    description: "Launch a background task",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string" },
        prompt: { type: "string" },
        agent: { type: "string" },
      },
      required: ["description", "prompt", "agent"],
    },
    execute: async (input) => {
      const task = await manager.launch({
        description: String(input.description ?? ""),
        prompt: String(input.prompt ?? ""),
        agent: String(input.agent ?? "assistant"),
      })
      return {
        task_id: task.id,
        status: task.status,
        session_id: task.sessionId,
        message: "Use background_output to poll for results.",
      }
    },
  }
}

export const createBackgroundOutputTool = (manager: BackgroundTaskManager): ToolDefinition => {
  return {
    description: "Check background task status and output",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string" },
      },
      required: ["task_id"],
    },
    execute: async (input) => {
      const result = await manager.getResult(String(input.task_id ?? ""))
      return result
    },
  }
}

export const createBackgroundCancelTool = (manager: BackgroundTaskManager): ToolDefinition => {
  return {
    description: "Cancel a background task",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string" },
      },
      required: ["task_id"],
    },
    execute: async (input) => {
      const taskId = String(input.task_id ?? "")
      const cancelled = await manager.cancel(taskId)
      return { task_id: taskId, cancelled }
    },
  }
}
