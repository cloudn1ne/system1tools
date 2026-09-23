import type { ApiSettings, QuestionDef, TemplateDef } from './types'

export interface SendOptions {
  state: string | Record<string, unknown>
  questions: Record<string, unknown>
}

/** Build the questions payload for a template. */
export function questionsPayload(template: TemplateDef): Record<string, unknown> {
  const questions: Record<string, unknown> = {}
  for (const q of template.questions) {
    const payload: Record<string, unknown> = { type: q.type, instructions: q.instructions }
    if (q.criteria) payload.criteria = q.criteria
    questions[q.id] = payload
  }
  return questions
}

/** POST one state + questions to the configured endpoint. */
export async function sendSystemOne(
  settings: ApiSettings,
  opts: SendOptions,
): Promise<unknown> {
  const url = `${settings.baseUrl}${settings.endpoint || '/v1/systemone'}`
  const body = {
    model: settings.model,
    state: opts.state,
    questions: opts.questions,
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (settings.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const j = await res.json()
      if (j?.detail) detail = String(j.detail)
      else if (j?.error?.message) detail = String(j.error.message)
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return res.json()
}
