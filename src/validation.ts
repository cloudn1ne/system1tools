import type { QuestionDef, TemplateDef } from './types'

export interface Issues {
  errors: string[]
  warnings: string[]
}

/**
 * Words the checkpoints can latch onto instead of reading the state.
 * Laya renders noul as `false:`/`true:` and can follow those labels (#156);
 * the README also warns against true/false/yes/no keys on `choice`.
 */
const BOOLEAN_WORDS = new Set(['true', 'false', 'yes', 'no'])

/** Laya scores every option inside one fixed head budget; >20 options degrades badly. */
const HIGH_CARDINALITY = 20

export function validateQuestion(q: QuestionDef): Issues {
  const errors: string[] = []
  const warnings: string[] = []
  const where = (m: string) => `${q.id || '(unnamed)'}: ${m}`

  if (!q.id.trim()) errors.push(where('question name is required (it becomes the answer key)'))
  if (!q.instructions.trim()) errors.push(where('instructions are required'))

  if (q.type === 'noul') {
    if (q.criteria) {
      if (!Array.isArray(q.criteria)) {
        const bad = Object.keys(q.criteria).filter((k) => k !== 'true' && k !== 'false')
        if (bad.length)
          errors.push(
            where(
              `noul 'criteria' may only be keyed 'true'/'false', got [${bad.join(', ')}] — the server rejects this (422). Use 'labels' to change the wording.`,
            ),
          )
      } else {
        errors.push(where("noul 'criteria' must be a true/false map, not a list"))
      }
    }
    const l = q.labels
    if (l) {
      const f = (l.false ?? '').trim()
      const t = (l.true ?? '').trim()
      if (f || t) {
        if (!f || !t) errors.push(where("noul 'labels' needs both 'false' and 'true' filled in"))
        else if (f === t) errors.push(where("noul 'labels' false and true must be different strings"))
      }
    }
  }

  if (q.type === 'choice') {
    const keys = q.criteria
      ? Array.isArray(q.criteria)
        ? q.criteria.map((s) => s.trim())
        : Object.keys(q.criteria).map((s) => s.trim())
      : []
    const filled = keys.filter(Boolean)
    if (filled.length < 2) errors.push(where('choice needs at least 2 options'))
    const dup = filled.filter((k, i) => filled.indexOf(k) !== i)
    if (dup.length) errors.push(where(`duplicate option keys: ${[...new Set(dup)].join(', ')}`))
    const boolKeys = filled.filter((k) => BOOLEAN_WORDS.has(k.toLowerCase()))
    if (boolKeys.length)
      warnings.push(
        where(
          `option keys ${boolKeys.join(', ')} are boolean words — checkpoints can follow the label instead of the description. Prefer semantic or opaque keys (A/B).`,
        ),
      )
    if (filled.length > HIGH_CARDINALITY)
      warnings.push(
        where(
          `${filled.length} options share one head token budget — accuracy falls off past ~20 options. Consider splitting into a coarse + fine question.`,
        ),
      )
  }

  if (q.type === 'score') {
    if (!q.criteria || !Array.isArray(q.criteria)) {
      errors.push(where("score 'criteria' must be an ordered list of ordinal levels"))
    } else {
      const filled = q.criteria.map((s) => s.trim()).filter(Boolean)
      if (filled.length < 2) errors.push(where('score needs at least 2 ordinal levels'))
      if (filled.length !== q.criteria.length) warnings.push(where('empty score levels will be dropped'))
      if (filled.length > HIGH_CARDINALITY)
        warnings.push(where(`${filled.length} levels is a lot for one ordinal rubric`))
    }
    if (q.labels) warnings.push(where("noul-only 'labels' is ignored on a score question"))
  }

  return { errors, warnings }
}

export function validateTemplate(t: TemplateDef): Issues {
  const errors: string[] = []
  const warnings: string[] = []

  if (!t.label.trim()) errors.push('template name is required')
  if (t.questions.length === 0) errors.push('add at least one question')

  const ids = t.questions.map((q) => q.id.trim())
  const dup = ids.filter((id, i) => id && ids.indexOf(id) !== i)
  if (dup.length) errors.push(`duplicate question names: ${[...new Set(dup)].join(', ')} (answer keys must be unique)`)

  for (const q of t.questions) {
    const r = validateQuestion(q)
    errors.push(...r.errors)
    warnings.push(...r.warnings)
  }

  if (t.questions.length > 50)
    warnings.push(`${t.questions.length} questions in one call — the server caps request size and question count`)

  return { errors, warnings }
}
