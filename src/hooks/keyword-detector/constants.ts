export const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
export const INLINE_CODE_PATTERN = /`[^`]*`/g

export const KEYWORD_DETECTORS = {
  ultrawork: {
    pattern: /\bultrawork\b/i,
    message:
      "Enable ultrawork mode: think hard, use tools aggressively, and provide exhaustive reasoning with verification steps.",
  },
  search: {
    pattern: /\bsearch\b/i,
    message: "Use codebase search tools (glob/grep/ast_grep) before answering.",
  },
  analyze: {
    pattern: /\banalyze\b/i,
    message: "Provide structured analysis and clearly separated conclusion.",
  },
}
