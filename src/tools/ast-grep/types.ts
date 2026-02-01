export type SgMatch = {
  file: string
  line: number
  column: number
  text: string
}

export type SgResult = {
  matches: SgMatch[]
  truncated: boolean
  rawOutput?: string
}
