import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { BackgroundTaskManager } from "../../background/manager.js"

export const createBackgroundTaskTool = (manager: BackgroundTaskManager): ToolDefinition => {
  return tool({
    description: "Launch a background task",
    args: {
      description: tool.schema.string().describe("Description of the task"),
      prompt: tool.schema.string().describe("The prompt for the task"),
      agent: tool.schema.string().describe("The agent type to use"),
    },
    execute: async (args) => {
      const task = await manager.launch({
        description: args.description,
        prompt: args.prompt,
        agent: args.agent,
      })
      return JSON.stringify({
        task_id: task.id,
        status: task.status,
        session_id: task.sessionId,
        message: "Use background_output to poll for results.",
      })
    },
  })
}

export const createBackgroundOutputTool = (manager: BackgroundTaskManager): ToolDefinition => {
  return tool({
    description: "Check background task status and output",
    args: {
      task_id: tool.schema.string().describe("The task ID to check"),
    },
    execute: async (args) => {
      const result = await manager.getResult(args.task_id)
      return JSON.stringify(result)
    },
  })
}

export const createBackgroundCancelTool = (manager: BackgroundTaskManager): ToolDefinition => {
  return tool({
    description: "Cancel a background task",
    args: {
      task_id: tool.schema.string().describe("The task ID to cancel"),
    },
    execute: async (args) => {
      const cancelled = await manager.cancel(args.task_id)
      return JSON.stringify({ task_id: args.task_id, cancelled })
    },
  })
}