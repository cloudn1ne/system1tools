export type QuestionType = 'noul' | 'score' | 'choice'

export interface QuestionDef {
  id: string
  type: QuestionType
  instructions: string
  /** For choice/score: map of option -> description, or array of options */
  criteria?: Record<string, string> | string[]
}

export interface TemplateDef {
  id: string
  label: string
  description: string
  questions: QuestionDef[]
  /** Whether each input line may be a JSON object (structured event) */
  structuredInput?: boolean
}

export interface ApiSettings {
  baseUrl: string
  apiKey: string
  model: string
  endpoint: string
}

/** Parsed answer for a single question on a single line. */
export interface ParsedAnswer {
  questionId: string
  type: QuestionType
  /** numeric probability for noul */
  prob?: number
  /** selected option label for choice/score */
  value?: string
  /** model's confidence (0-1) when reported */
  confidence?: number
  /** full probability distribution over options for choice */
  probabilities?: Record<string, number>
  raw: unknown
}

export interface LineResult {
  line: number
  stateText: string
  ok: boolean
  error?: string
  answers: ParsedAnswer[]
  /** full raw JSON returned by /v1/systemone for this line */
  raw?: unknown
}

export interface AggregatedQuestion {
  id: string
  type: QuestionType
  instructions: string
  total: number
  /** noul stats */
  yesCount: number
  noCount: number
  meanProb: number
  meanConfidence: number
  /** choice/score distribution */
  counts: Record<string, number>
  /** average probability per option (choice) */
  avgProbs: Record<string, number>
  /** noul histogram buckets (0.0-0.2 ... 0.8-1.0) */
  buckets: number[]
  /** raw probs for scatter */
  probs: number[]
}
