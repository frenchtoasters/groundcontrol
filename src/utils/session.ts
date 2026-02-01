export const resolveSessionId = (input: Record<string, unknown>): string | undefined => {
  const session = input.session as { id?: string } | undefined
  return (
    session?.id ||
    (input.sessionId as string | undefined) ||
    (input.session_id as string | undefined) ||
    (input.id as string | undefined)
  )
}

export const extractTextParts = (
  entry: { parts?: Array<{ type?: string; text?: string }> },
): string[] => {
  return (entry.parts ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim())
    .filter((text): text is string => Boolean(text))
}

export const formatMessageLines = (
  entry: { info?: { role?: string; type?: string }; parts?: Array<{ type?: string; text?: string }> },
): string => {
  const role = entry.info?.role ?? entry.info?.type ?? "assistant"
  const textParts = extractTextParts(entry)
  if (textParts.length === 0) {
    return `## ${role}`
  }
  return `## ${role}\n${textParts.join("\n\n")}`
}
