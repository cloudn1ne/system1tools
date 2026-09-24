import { questionsPayload, sendSystemOne } from '../src/api'
import { extractAnswers, parseAnswer } from '../src/parser'
import { aggregate } from '../src/aggregate'
import { validateTemplate } from '../src/validation'
import { BUILTIN_TEMPLATES } from '../src/presets'
import type { LineResult, TemplateDef } from '../src/types'

const t = (q: unknown): TemplateDef => ({ id: 'x', label: 'x', description: '', questions: q as never })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++ }

// 1. score payload = ordered list; noul labels emitted; noul criteria only true/false
const p = questionsPayload(t([
  { id: 'urg', type: 'score', instructions: 'u?', criteria: ['not urgent', 'soon', '  ', 'critical'] },
  { id: 'phish', type: 'noul', instructions: 'p?', criteria: { true: 'fraud', false: 'legit', bogus: 'x' }, labels: { false: 'B', true: 'A' } },
  { id: 'topic', type: 'choice', instructions: 't?', criteria: { coding: null, other: 'rest' } },
]))
ok(JSON.stringify(p.urg.criteria) === '["not urgent","soon","critical"]', `score -> list, blanks dropped (${JSON.stringify(p.urg.criteria)})`)
ok(p.noul === undefined && (p.phish as any).labels?.true === 'A', 'noul labels emitted')
ok(!(p.phish as any).criteria.bogus, 'noul bogus criteria key dropped by payload builder')
ok(JSON.stringify((p.topic as any).criteria) === '{"coding":null,"other":"rest"}', 'choice keeps null description (laya preset style)')

// 2. validation catches the rules the server 422s on
const bad = validateTemplate(t([{ id: 'a', type: 'noul', instructions: 'x?', criteria: { yes: 'y', no: 'n' } }]))
ok(bad.errors.some((e) => e.includes("only be keyed 'true'/'false'")), 'noul yes/no criteria rejected client-side')
ok(validateTemplate(t([{ id: 'a', type: 'choice', instructions: 'i', criteria: ['one'] }])).errors.some(e => e.includes('at least 2')), 'choice needs 2 options')
ok(validateTemplate(t([{ id: 'a', type: 'choice', instructions: 'i', criteria: { yes: 'y', no: 'n' } }])).warnings.some(e => e.includes('boolean words')), 'boolean-word choice keys warned')
ok(validateTemplate(t([{ id: 'a', type: 'noul', instructions: 'i', labels: { false: 'A', true: 'A' } }])).errors.some(e => e.includes('must be different')), 'identical noul labels rejected')
ok(BUILTIN_TEMPLATES.every((b) => validateTemplate(b).errors.length === 0), 'all built-in presets pass validation')

// 3. THE SCORE BUG: real laya score answer must parse to a number + level name
const scoreRaw = { type: 'score', score: 1.2215, legend: { '0': 'not urgent', '1': 'soon', '2': 'critical deadline or blocking issue' }, probabilities: { '0': 0.194, '1': 0.3904, '2': 0.4156 }, confidence: 0.044, action: { act_probability: 1 } }
const sp = parseAnswer({ id: 'urg', type: 'score', instructions: 'u' } as never, scoreRaw)
ok(sp.score === 1.2215, `score parsed as number (${sp.score})`)
ok(sp.value === 'critical deadline or blocking issue', `level named via legend argmax (${sp.value})`)
ok(sp.value !== 'score', 'regression: no longer returns the literal string "score"')

// 4. aggregation over a few lines
const mk = (line: number, qid: string, raw: unknown): LineResult => ({ line, stateText: 's', ok: true, answers: [parseAnswer({ id: qid, type: 'noul', instructions: '' } as never, raw)] })
const aggs = aggregate([mk(1, 'a', { noul: 0.9, confidence: 0.9 }), mk(2, 'a', { noul: 0.2, confidence: 0.2 })], [{ id: 'a', type: 'noul', instructions: '' }])
ok(aggs[0].yesCount === 1 && aggs[0].noCount === 1 && Math.abs(aggs[0].meanProb - 0.55) < 1e-9, 'noul yes/no split + mean')
const sagg = aggregate([{ line: 1, stateText: 's', ok: true, answers: [sp] }], [{ id: 'urg', type: 'score', instructions: '' }])
ok(Math.abs(sagg[0].meanScore - 1.2215) < 1e-9 && sagg[0].levelCount === 3, `score mean=${sagg[0].meanScore} levels=${sagg[0].levelCount}`)
ok(sagg[0].avgProbs['soon'] !== undefined, 'score avg probability keyed by level description')

// 5. checkpoint handling — live endpoint, skipped when offline
const key = process.env.LITELLM_API_KEY ?? ''
const settings = {
  baseUrl: process.env.LITELLM_BASE_URL || 'https://ai.warp.at',
  apiKey: key,
  endpoint: '/v1/systemone',
}

if (!key || process.env.OFFLINE === '1') {
  console.log('SKIP  live endpoint checks (set LITELLM_API_KEY, or OFFLINE=1 to skip)')
} else {
  const q = questionsPayload(t([{ id: 'a', type: 'noul', instructions: 'Is this about billing?' }]))
  const r1: any = await sendSystemOne(settings, { state: 'I was charged twice.', questions: q, checkpoint: 'typed-decisions', model: 'laya' })
  ok(r1.routing?.model === 'typed-decisions', `checkpoint pin honoured (${r1.routing?.reason})`)
  const r2: any = await sendSystemOne(settings, { state: 'मुझसे दो बार शुल्क लिये गए।', questions: q, checkpoint: 'auto', model: '' })
  ok(r2.routing?.model === 'multilingual', `auto routing picks multilingual for Devanagari (${r2.routing?.model})`)
  const r3: any = await sendSystemOne(settings, { state: 'disk at 96%', questions: questionsPayload(t([{ id: 'u', type: 'score', instructions: 'urgent?', criteria: ['no', 'soon', 'blocking'] }])), checkpoint: 'auto', model: '' })
  ok(typeof r3.answers?.u?.score === 'number', `live score answer is numeric (${r3.answers?.u?.score})`)
}

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`)
process.exit(fails === 0 ? 0 : 1)
