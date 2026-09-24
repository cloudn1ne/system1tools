export type QuestionType = 'noul' | 'choice' | 'score'

/** Laya checkpoints. 'auto' omits the model field so the Router picks by script/language. */
export type Checkpoint = 'auto' | 'english' | 'multilingual' | 'typed-decisions'

export const CHECKPOINTS: Checkpoint[] = ['auto', 'english', 'multilingual', 'typed-decisions']

export interface QuestionDef {
  id: string
  type: QuestionType
  instructions: string
  /**
   * choice: { key: description } or a list of option names.
   * score: ordered list of ordinal level descriptions.
   * noul: optional { true: text, false: text } — only these two keys are legal.
   */
  criteria?: Record<string, string | null> | string[]
  /** noul only: overrides the model-facing wording; keys must be exactly 'false' and 'true'. */
  labels?: { false?: string; true?: string }
}

export interface TemplateDef {
  id: string
  label: string
  description: string
  checkpoint?: Checkpoint
  questions: QuestionDef[]
  /** each input line may be a JSON object (structured event) */
  structuredInput?: boolean
  /** false = user-created, editable/deletable; true = seeded built-in */
  builtin?: boolean
}

export interface ApiSettings {
  baseUrl: string
  apiKey: string
  model: string
  endpoint: string
  /** flag answers whose confidence falls below this (Laya: gate on confidence, not act_probability) */
  confidenceGate: number
}

/** Parsed answer for a single question on a single line. */
export interface ParsedAnswer {
  questionId: string
  type: QuestionType
  /** noul probability P(true) */
  prob?: number
  /** score: expected ordinal level */
  score?: number
  /** score: index -> level description */
  legend?: Record<string, string>
  /** selected option label for choice */
  value?: string
  /** model's confidence (0-1) */
  confidence?: number
  /** full probability distribution over options */
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
  /** choice/score distribution over selected options/levels */
  counts: Record<string, number>
  /** average probability per option/level */
  avgProbs: Record<string, number>
  /** score: mean expected level and the number of levels */
  meanScore: number
  levelCount: number
  /** noul histogram buckets (0.0-0.2 ... 0.8-1.0) */
  buckets: number[]
  /** raw probs for scatter */
  probs: number[]
}
