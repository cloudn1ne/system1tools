import type { Checkpoint, QuestionDef, QuestionType, TemplateDef } from './types'

const ENVELOPE = 'system1-analyzer'
const TYPES: QuestionType[] = ['noul', 'choice', 'score']
const CHECKPOINTS: Checkpoint[] = ['auto', 'english', 'multilingual', 'typed-decisions']

/** Export schema version, so future format changes can be detected. */
export const FORMAT_VERSION = 1

export function questionToJson(q: QuestionDef): string {
  return JSON.stringify(q, null, 2)
}

export function templateToJson(t: TemplateDef): string {
  return JSON.stringify({ [ENVELOPE]: FORMAT_VERSION, templates: [t] }, null, 2)
}

export function templatesToJson(list: TemplateDef[]): string {
  return JSON.stringify(
    { [ENVELOPE]: FORMAT_VERSION, exportedAt: new Date().toISOString(), templates: list },
    null,
    2,
  )
}

export function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'questions'
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(new Error(`could not read ${file.name}`))
    r.readAsText(file)
  })
}

// ---------------------------------------------------------------- parsing ---

function isQuestion(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const o = v as Record<string, unknown>
  return typeof o.type === 'string' && TYPES.includes(o.type as QuestionType) && 'instructions' in o
}

function normalizeQuestion(name: string, raw: Record<string, unknown>, fallbackIndex: number): QuestionDef {
  const type = TYPES.includes(raw.type as QuestionType) ? (raw.type as QuestionType) : 'noul'
  const q: QuestionDef = {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : name || `question_${fallbackIndex + 1}`,
    type,
    instructions: typeof raw.instructions === 'string' ? raw.instructions : '',
  }

  if (Array.isArray(raw.criteria)) {
    q.criteria = (raw.criteria as unknown[]).map((s) => String(s))
  } else if (raw.criteria && typeof raw.criteria === 'object') {
    const rec: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(raw.criteria as Record<string, unknown>)) {
      rec[k] = v === null || v === undefined ? null : String(v)
    }
    q.criteria = rec
  }

  if (type === 'noul' && raw.labels && typeof raw.labels === 'object') {
    const l = raw.labels as Record<string, unknown>
    const out: { false?: string; true?: string } = {}
    if (typeof l.false === 'string') out.false = l.false
    if (typeof l.true === 'string') out.true = l.true
    if (Object.keys(out).length) q.labels = out
  }

  return q
}

/** Accepts a laya `questions` map ({name: {...}}) or an array of question objects. */
function questionsFrom(src: unknown, notes: string[]): QuestionDef[] {
  if (Array.isArray(src)) {
    return src
      .filter(isQuestion)
      .map((q, i) => normalizeQuestion(String(q.id ?? ''), q, i))
  }
  if (src && typeof src === 'object') {
    const entries = Object.entries(src as Record<string, unknown>)
    const kept: QuestionDef[] = []
    for (const [name, value] of entries) {
      if (isQuestion(value)) kept.push(normalizeQuestion(name, value, kept.length))
      else notes.push(`skipped '${name}' (not a noul/choice/score question)`)
    }
    return kept
  }
  return []
}

function normalizeTemplate(raw: unknown, index: number, notes: string[]): TemplateDef | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>

  // a bare question object on its own becomes a one-question set
  if (isQuestion(o) && !('questions' in o)) {
    return {
      id: typeof o.id === 'string' && o.id.trim() ? `imported_${slug(o.id)}` : `imported_${index + 1}`,
      label: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `Imported set ${index + 1}`,
      description: '',
      checkpoint: 'auto',
      builtin: false,
      questions: [normalizeQuestion(String(o.id ?? ''), o, 0)],
    }
  }

  const src = o.questions ?? o
  const questions = questionsFrom(src, notes)
  if (questions.length === 0) return null

  const checkpoint = CHECKPOINTS.includes(o.checkpoint as Checkpoint) ? (o.checkpoint as Checkpoint) : 'auto'
  const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : `Imported set ${index + 1}`
  const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `imported_${index + 1}_${Date.now().toString(36)}`

  return {
    id,
    label,
    description: typeof o.description === 'string' ? o.description : '',
    checkpoint,
    questions,
    structuredInput: !!o.structuredInput,
    builtin: false,
  }
}

export interface ParsedImport {
  templates: TemplateDef[]
  notes: string[]
}

/**
 * Tolerant import. Accepts, in order of preference:
 *  1. our export envelope            { "system1-analyzer": 1, templates: [...] }
 *  2. an array of templates          [ {label, questions}, ... ]
 *  3. a wrapped questions object     { questions: { name: {...} } }
 *  4. a bare laya questions map      { name: { type, instructions, criteria }, ... }
 *  5. a single question object       { type: "noul", instructions: "..." }
 * Anything that is not a noul/choice/score question is skipped and reported.
 */
export function parseImport(text: string): ParsedImport {
  const notes: string[] = []
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    throw new Error(`not valid JSON: ${e instanceof Error ? e.message : String(e)}`)
  }

  let rawList: unknown[]

  if (Array.isArray(data)) {
    // either a list of templates, or a bare list of questions
    rawList = data.length && isQuestion(data[0]) && !('questions' in (data[0] as object))
      ? [{ label: 'Imported set', questions: data }]
      : data
  } else if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    const envelope = o[ENVELOPE]
    if (envelope !== undefined && Array.isArray(o.templates)) {
      if (Number(envelope) > FORMAT_VERSION) notes.push(`file format v${String(envelope)} is newer than this app supports (v${FORMAT_VERSION})`)
      rawList = o.templates as unknown[]
    } else if ('questions' in o) {
      rawList = [o]
    } else if (isQuestion(o)) {
      rawList = [o]
    } else {
      // bare {name: question} map — the shape Laya's docs and presets use
      notes.push('read as a laya questions map')
      rawList = [{ label: 'Imported questions', questions: o }]
    }
  } else {
    throw new Error('expected a JSON object or array')
  }

  const templates: TemplateDef[] = []
  rawList.forEach((raw, i) => {
    const t = normalizeTemplate(raw, i + templates.length, notes)
    if (t) templates.push(t)
    else notes.push(`skipped entry ${i + 1} (no usable questions)`)
  })

  if (templates.length === 0) throw new Error('no noul/choice/score questions found in that file')
  return { templates, notes }
}
