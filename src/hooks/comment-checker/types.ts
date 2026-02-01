export type PendingCall = {
  filePath?: string
  content?: string
  oldString?: string
  newString?: string
  edits?: Array<{ oldString?: string; newString?: string }>
  tool: string
  sessionId: string
  timestamp: number
}

export type CommentCheckerResult = {
  hasComments: boolean
  message?: string
}
