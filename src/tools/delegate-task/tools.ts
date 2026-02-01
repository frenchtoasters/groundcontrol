import type { GroundcontrolConfig } from "../../config.js"
import type { BackgroundTaskManager } from "../../background/manager.js"
import { formatMessageLines } from "../../utils/session.js"

type ToolDefinition = {
  description: string
  parameters: Record<string, unknown>
  execute: (input: Record<string, unknown>, context?: Record<string, unknown>) => Promise<unknown>
}

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
  return {
    description: "Delegate a task to another agent",
    parameters: {
      type: "object",
      properties: {
        load_skills: { type: "array", items: { type: "string" } },
        description: { type: "string" },
        prompt: { type: "string" },
        run_in_background: { type: "boolean" },
        category: { type: "string" },
        subagent_type: { type: "string" },
        session_id: { type: "string" },
        command: { type: "string" },
      },
      required: ["load_skills", "description", "prompt", "run_in_background"],
    },
    execute: async (input, ctx) => {
      const runInBackground = Boolean(input.run_in_background)
      const sessionId = input.session_id as string | undefined
      const prompt = String(input.prompt ?? "")
      const description = String(input.description ?? "")
      const agent = (input.subagent_type as string | undefined) || (input.category as string | undefined) || "assistant"

      if (runInBackground) {
        const task = sessionId
          ? await manager.resume(sessionId, prompt)
          : await manager.launch({
              description,
              prompt,
              agent,
              parentSessionId: (ctx?.session as { id?: string } | undefined)?.id,
            })

        if (!task) {
          return { error: "Unable to resume background task", status: "failed" }
        }

        return {
          status: task.status,
          task_id: task.id,
          session_id: task.sessionId,
          message: "Use background_output to poll for results.",
        }
      }

      const response = sessionId
        ? { id: sessionId }
        : await client.session.create({ body: { parentID: (ctx?.session as { id?: string } | undefined)?.id } })
      const childSessionId = sessionId ?? resolveSessionId(response)
      if (!childSessionId) {
        return { error: "Failed to create delegated session" }
      }

      await client.session.prompt({
        path: { id: childSessionId },
        body: { content: prompt, agent },
      })
      const messages = await client.session.messages({ path: { id: childSessionId } })
      const entries = (messages as { data?: Array<{ info?: { role?: string }; parts?: Array<{ type?: string; text?: string }> }> }).data ?? []
      return {
        session_id: childSessionId,
        output: formatMessages(entries),
      }
    },
  }
}
