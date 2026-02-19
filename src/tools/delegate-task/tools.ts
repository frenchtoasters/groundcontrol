import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import type { GroundcontrolConfig } from "../../config.js"
import type { BackgroundTaskManager } from "../../background/manager.js"
import { formatMessageLines } from "../../utils/session.js"

type PluginClient = {
  session: {
    create: (input: unknown) => Promise<unknown>
    prompt: (input: unknown) => Promise<unknown>
    messages: (input: unknown) => Promise<unknown>
  }
}

const resolveSessionId = (response: unknown): string | undefined => {
  if (!response || typeof response !== "object") return undefined
  const asRecord = response as Record<string, unknown>
  const data = asRecord.data as Record<string, unknown> | undefined
  return (
    (data?.id as string | undefined) ||
    (asRecord.id as string | undefined) ||
    (asRecord.sessionId as string | undefined)
  )
}

const formatMessages = (
  messages: Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }>,
): string => {
  return messages.map((message) => formatMessageLines(message)).join("\n\n")
}

export const createDelegateTaskTool = (
  manager: BackgroundTaskManager,
  client: PluginClient,
  _config: GroundcontrolConfig,
): ToolDefinition => {
  return tool({
    description: "Delegate a task to another agent",
    args: {
      load_skills: tool.schema.array(tool.schema.string()).describe("Skills to load for the subagent"),
      description: tool.schema.string().describe("Description of the task"),
      prompt: tool.schema.string().describe("The prompt for the subagent"),
      run_in_background: tool.schema.boolean().describe("Run the task in background"),
      category: tool.schema.string().optional().describe("Agent category"),
      subagent_type: tool.schema.string().optional().describe("Subagent type"),
      session_id: tool.schema.string().optional().describe("Session ID to resume"),
      command: tool.schema.string().optional().describe("Command to run"),
    },
    execute: async (args, context) => {
      const runInBackground = args.run_in_background
      const sessionId = args.session_id
      const prompt = args.prompt
      const description = args.description
      const agent = args.subagent_type || args.category || "assistant"

      if (runInBackground) {
        const task = sessionId
          ? await manager.resume(sessionId, prompt)
          : await manager.launch({
              description,
              prompt,
              agent,
              parentSessionId: context.sessionID,
            })

        if (!task) {
          return JSON.stringify({ error: "Unable to resume background task", status: "failed" })
        }

        return JSON.stringify({
          status: task.status,
          task_id: task.id,
          session_id: task.sessionId,
          message: "Use background_output to poll for results.",
        })
      }

      const response = sessionId
        ? { id: sessionId }
        : await client.session.create({ body: { parentID: context.sessionID } })
      const childSessionId = sessionId ?? resolveSessionId(response)
      if (!childSessionId) {
        return JSON.stringify({ error: "Failed to create delegated session" })
      }

      await client.session.prompt({
        path: { id: childSessionId },
        body: { content: prompt, agent },
      })
      const messages = await client.session.messages({ path: { id: childSessionId } })
      const entries = (messages as { data?: Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }> }).data ?? []
      return JSON.stringify({
        session_id: childSessionId,
        output: formatMessages(entries),
      })
    },
  })
}