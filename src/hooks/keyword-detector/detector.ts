import { CODE_BLOCK_PATTERN, INLINE_CODE_PATTERN, KEYWORD_DETECTORS } from "./constants.js"

export const stripCodeBlocks = (input: string): string => {
  return input.replace(CODE_BLOCK_PATTERN, "").replace(INLINE_CODE_PATTERN, "")
}

export const detectKeywords = (input: string): string[] => {
  const sanitized = stripCodeBlocks(input)
  return Object.entries(KEYWORD_DETECTORS)
    .filter(([, detector]) => detector.pattern.test(sanitized))
    .map(([key]) => key)
}

export const getKeywordMessages = (keywords: string[]): string[] => {
  return keywords.map((key) => KEYWORD_DETECTORS[key as keyof typeof KEYWORD_DETECTORS]?.message)
    .filter((message): message is string => Boolean(message))
}
