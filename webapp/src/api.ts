import type { Checkpoint, QuestionDef, TemplateDef } from './types'

export interface SendOptions {
  state: string | Record<string, unknown>
  questions: Record<string, unknown>
  /** omit the model field entirely for Router auto-selection */
  checkpoint: Checkpoint
  /** LiteLLM model name; only used when the checkpoint is 'auto' and this is set */
  model: string
}

function cleanNoulCriteria(q: QuestionDef): Record<string, string> | undefined {
  if (!q.criteria || Array.isArray(q.criteria)) return undefined
  const out: Record<string, string> = {}
  for (const key of ['true', 'false']) {
    const v = q.criteria[key]
    if (v !== null && v !== undefined && String(v).trim()) out[key] = String(v).trim()
  }
  return Object.keys(out).length ? out : undefined
}

function cleanLabels(q: QuestionDef): { false: string; true: string } | undefined {
  const f = (q.labels?.false ?? '').trim()
  const t = (q.labels?.true ?? '').trim()
  return f && t ? { false: f, true: t } : undefined
}

/** Build the questions payload, per-primitive, dropping empty optionals. */
export function questionsPayload(template: TemplateDef): Record<string, unknown> {
  const questions: Record<string, unknown> = {}

  for (const q of template.questions) {
    const payload: Record<string, unknown> = { type: q.type, instructions: q.instructions }

    if (q.type === 'noul') {
      const crit = cleanNoulCriteria(q)
      if (crit) payload.criteria = crit
      const labels = cleanLabels(q)
      if (labels) payload.labels = labels
    } else if (q.type === 'score') {
      const levels = (Array.isArray(q.criteria) ? q.criteria : []).map((s) => s.trim()).filter(Boolean)
      if (levels.length) payload.criteria = levels
    } else if (Array.isArray(q.criteria)) {
      // choice accepts a bare list of option names too
      const opts = q.criteria.map((s) => s.trim()).filter(Boolean)
      if (opts.length) payload.criteria = opts
    } else if (q.criteria) {
      // { key: description }; a null/empty description is legal (Laya's own presets use it)
      const clean: Record<string, string | null> = {}
      for (const [k, v] of Object.entries(q.criteria)) {
        const key = k.trim()
        if (!key) continue
        clean[key] = v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim()
      }
      if (Object.keys(clean).length) payload.criteria = clean
    }

    questions[q.id] = payload
  }
  return questions
}

/** POST one state + questions to the configured /v1/systemone endpoint. */
export async function sendSystemOne(
  settings: { baseUrl: string; apiKey: string; endpoint: string },
  opts: SendOptions,
): Promise<unknown> {
  const url = `${settings.baseUrl}${settings.endpoint || '/v1/systemone'}`

  const body: Record<string, unknown> = { state: opts.state, questions: opts.questions }
  // A client `model` naming a Laya checkpoint pins it; any other value disables auto-routing.
  if (opts.checkpoint !== 'auto') body.model = opts.checkpoint
  else if (opts.model.trim()) body.model = opts.model.trim()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (settings.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      if (typeof j?.detail === 'string') detail = j.detail
      else if (j?.detail) detail = JSON.stringify(j.detail)
      else if (j?.error?.message) detail = String(j.error.message)
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  return res.json()
}
