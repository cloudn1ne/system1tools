import type { ParsedAnswer, QuestionDef } from './types'

/**
 * Parse the `answers` map returned by /v1/systemone for one question.
 * Defensive: handles { noul: 0.97 }, { choice: "x" }, { score: {value|label} },
 * and nested object forms.
 */
export function parseAnswer(q: QuestionDef, raw: unknown): ParsedAnswer {
  const base: ParsedAnswer = { questionId: q.id, type: q.type, raw }

  if (typeof raw === 'number') {
    // A bare number -> treat as probability (noul)
    base.prob = raw
    return base
  }
  if (typeof raw === 'string') {
    base.value = raw
    return base
  }
  if (Array.isArray(raw) && raw.length > 0) {
    base.value = String(raw[0])
    return base
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    // model confidence + full probability distribution (Laya response shape)
    const conf = o['confidence']
    if (typeof conf === 'number') base.confidence = conf
    const probs = o['probabilities']
    if (probs && typeof probs === 'object') {
      const dist: Record<string, number> = {}
      for (const [k, v] of Object.entries(probs as Record<string, unknown>)) {
        if (typeof v === 'number') dist[k] = v
      }
      base.probabilities = dist
    }
    // numeric probability
    for (const k of ['noul', 'probability', 'prob', 'p']) {
      const v = o[k]
      if (typeof v === 'number') {
        base.prob = v
        return base
      }
    }
    // selected label/value
    for (const k of ['value', 'label', 'choice', 'selected', 'result', 'answer']) {
      const v = o[k]
      if (typeof v === 'string' || typeof v === 'number') {
        base.value = String(v)
        return base
      }
    }
    // maybe a probabilities map over options -> pick argmax
    const probKeys = Object.keys(o).filter((k) => typeof o[k] === 'number')
    if (probKeys.length > 0) {
      const vals = probKeys.map((k) => [k, o[k] as number] as const)
      const max = vals.reduce((a, b) => (b[1] > a[1] ? b : a))
      base.value = max[0]
      return base
    }
  }
  // fallback: stringify
  base.value = String(raw)
  return base
}

/** Extract the answers map from a response payload. */
export function extractAnswers(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>
    if (p.answers && typeof p.answers === 'object') return p.answers as Record<string, unknown>
    // some proxies wrap per-question under choices/message
    if (p.choices && Array.isArray(p.choices)) {
      const first = p.choices[0]
      if (first && typeof first === 'object') {
        const msg = (first as Record<string, unknown>).message
        const content = msg ? (msg as Record<string, unknown>).content : null
        if (content && typeof content === 'object') return content as Record<string, unknown>
        if (typeof content === 'string') {
          try {
            const parsed = JSON.parse(content)
            if (parsed.answers) return parsed.answers
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
  return {}
}
