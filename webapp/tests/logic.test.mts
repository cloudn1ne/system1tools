import { questionsPayload, sendSystemOne } from '../src/api'
import { extractAnswers, parseAnswer } from '../src/parser'
import { aggregate } from '../src/aggregate'
import { validateTemplate } from '../src/validation'
import { parseImport, templateToJson, templatesToJson } from '../src/io'
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

// 5. import / export round-trips and tolerant shapes
const rich: TemplateDef = {
  id: 'rich', label: 'Rich set', description: 'd', checkpoint: 'multilingual', structuredInput: true, builtin: false,
  questions: [
    { id: 'n', type: 'noul', instructions: 'n?', criteria: { true: 'yes it is', false: 'no' }, labels: { false: 'B', true: 'A' } },
    { id: 's', type: 'score', instructions: 's?', criteria: ['lo', 'mid', 'hi'] },
    { id: 'c', type: 'choice', instructions: 'c?', criteria: { x: 'desc x', y: null } },
  ],
}
const back = parseImport(templatesToJson([...BUILTIN_TEMPLATES, rich]))
ok(back.templates.length === BUILTIN_TEMPLATES.length + 1, `export-all round trip keeps ${back.templates.length} sets`)
const richBack = back.templates.find((x) => x.id === 'rich')!
ok(richBack?.checkpoint === 'multilingual' && richBack?.structuredInput === true, 'checkpoint + JSON-input flag survive export')
ok(richBack.questions[0].labels?.true === 'A', 'noul labels survive export')
ok(JSON.stringify(richBack.questions[1].criteria) === '["lo","mid","hi"]', 'score level order survives export')
ok((richBack.questions[2].criteria as any).y === null, 'null choice description survives export')
ok(parseImport(templateToJson(rich)).templates.length === 1, 'single-set export imports back as one set')

const layaMap = parseImport(JSON.stringify({
  dept: { type: 'choice', instructions: 'which team?', criteria: { billing: 'refunds', tech: 'bugs' } },
  urgent: { type: 'noul', instructions: 'urgent?' },
}))
ok(layaMap.templates.length === 1 && layaMap.templates[0].questions.length === 2, 'bare laya questions map imports as one set')
ok(layaMap.templates[0].questions[0].id === 'dept', 'map keys become answer keys')

const wrapped = parseImport(JSON.stringify({ label: 'Wrapped', checkpoint: 'typed-decisions', questions: { a: { type: 'noul', instructions: 'a?' } } }))
ok(wrapped.templates[0].label === 'Wrapped' && wrapped.templates[0].checkpoint === 'typed-decisions', 'wrapped {questions:{...}} keeps metadata')

const one = parseImport(JSON.stringify({ type: 'score', instructions: 'how bad?', criteria: ['mild', 'bad'] }))
ok(one.templates.length === 1 && one.templates[0].questions[0].type === 'score', 'a lone question object imports as a one-question set')

const arr = parseImport(JSON.stringify([{ type: 'noul', instructions: 'q1?' }, { type: 'noul', instructions: 'q2?' }]))
ok(arr.templates[0].questions.length === 2, 'an array of bare questions becomes one set')

const mixed = parseImport(JSON.stringify({ good: { type: 'noul', instructions: 'ok?' }, junk: { foo: 1 } }))
ok(mixed.templates[0].questions.length === 1 && mixed.notes.some((n) => n.includes("skipped 'junk'")), 'non-questions skipped and reported')

let threw = ''
try { parseImport('{ not json') } catch (e) { threw = String(e) }
ok(threw.includes('not valid JSON'), `malformed JSON rejected (${threw.slice(0, 40)})`)
threw = ''
try { parseImport('{"a": 1}') } catch (e) { threw = String(e) }
ok(threw.includes('no noul/choice/score questions'), 'JSON with no questions rejected')

// 6. relay policy: target pinning and proxy resolution
import { isAllowedTarget, parseAllowlist, resolveProxy, proxyFromEnv, originOf } from '../dev/relayPolicy'

const allow = parseAllowlist('https://ai.warp.at, http://localhost:8003 ', 'https://ai.warp.at')
ok(allow.length === 2, `allowlist parsed + deduped (${allow.join(' ')})`)
ok(isAllowedTarget('https://ai.warp.at/v1/systemone', allow), 'configured target allowed')
ok(isAllowedTarget('https://ai.warp.at/anything', allow), 'same origin, different path still allowed')
ok(!isAllowedTarget('http://ai.warp.at/v1/systemone', allow), 'scheme downgrade not allowed')
ok(!isAllowedTarget('https://evil.example/v1/systemone', allow), 'other origin refused')
ok(!isAllowedTarget('https://ai.warp.at.evil.example/x', allow), 'suffix-spoof origin refused')
ok(!isAllowedTarget('file:///etc/passwd', allow), 'non-http scheme refused')
ok(!isAllowedTarget('not a url', allow), 'garbage refused')
ok(originOf('https://ai.warp.at:443/x') === 'https://ai.warp.at', 'default port normalised')

ok(resolveProxy('http://p:3128', 'http://env:8080') === 'http://p:3128', 'explicit proxy beats environment')
ok(resolveProxy('  ', 'http://env:8080') === 'http://env:8080', 'blank explicit falls back to environment')
ok(resolveProxy(undefined, '   ') === undefined, 'blank environment means no proxy')
ok(proxyFromEnv({ https_proxy: 'http://s:1' }, 'https://ai.warp.at') === 'http://s:1', 'https target uses https_proxy')
ok(proxyFromEnv({ http_proxy: 'http://s:1' }, 'http://ai.warp.at') === 'http://s:1', 'http target uses http_proxy')
ok(proxyFromEnv({ http_proxy: 'http://s:1' }, 'https://ai.warp.at') === 'http://s:1', 'falls through to http_proxy for https target')
ok(proxyFromEnv({}, 'https://ai.warp.at') === undefined, 'no proxy vars -> direct')

// 6b. what the client actually sends for each transport/proxy choice
import { targetUrl } from '../src/api'

ok(targetUrl({ baseUrl: 'https://ai.warp.at', endpoint: '/v1/systemone' }) === 'https://ai.warp.at/v1/systemone', 'target url joins base + endpoint')
ok(targetUrl({ baseUrl: 'http://h:8003', endpoint: '' }) === 'http://h:8003/v1/systemone', 'blank endpoint falls back to default path')

{
  const realFetch = globalThis.fetch
  let url = ''
  let headers: Record<string, string> = {}
  globalThis.fetch = (async (u: string, init: RequestInit) => {
    url = u
    headers = init.headers as Record<string, string>
    return { ok: true, json: async () => ({ answers: {} }) } as unknown as Response
  }) as typeof fetch

  // custom mode with a blank URL must refuse rather than silently go direct
  let sent = 0
  let msg = ''
  globalThis.fetch = (async () => {
    sent++
    return { ok: true, json: async () => ({}) } as unknown as Response
  }) as typeof fetch
  await sendSystemOne(
    { baseUrl: 'https://ai.warp.at', apiKey: '', endpoint: '/v1/systemone', transport: 'relay', proxyMode: 'custom', proxyUrl: '  ' },
    { state: 'x', questions: {}, checkpoint: 'auto', model: '' },
  ).catch((e: Error) => {
    msg = e.message
  })
  ok(sent === 0, 'custom proxy mode with no URL sends nothing')
  ok(/no proxy URL/i.test(msg), `and says why: ${msg}`)

  globalThis.fetch = (async (u: string, init: RequestInit) => {
    url = u
    headers = init.headers as Record<string, string>
    return { ok: true, json: async () => ({ answers: {} }) } as unknown as Response
  }) as typeof fetch

  await sendSystemOne(
    { baseUrl: 'https://ai.warp.at', apiKey: 'k', endpoint: '/v1/systemone', transport: 'relay', proxyMode: 'custom', proxyUrl: 'http://p:3128' },
    { state: 'x', questions: {}, checkpoint: 'auto', model: '' },
  )
  ok(url === '/__relay', `relay mode posts to the relay path, not the endpoint (${url})`)
  ok(headers['X-Relay-Target'] === 'https://ai.warp.at/v1/systemone', 'target carried as a header')
  ok(headers['X-Relay-Proxy'] === 'http://p:3128', 'custom proxy carried as a header')
  ok(headers.Authorization === 'Bearer k', 'auth forwarded through the relay')

  // 'auto' must send NO proxy header, so the server applies its own environment
  await sendSystemOne(
    { baseUrl: 'https://ai.warp.at', apiKey: '', endpoint: '/v1/systemone', transport: 'relay', proxyMode: 'auto', proxyUrl: 'ignored' },
    { state: 'x', questions: {}, checkpoint: 'auto', model: '' },
  )
  ok(headers['X-Relay-Proxy'] === undefined, "'auto' sends no proxy header, leaving it to the server")

  // 'none' sends an explicitly empty header
  await sendSystemOne(
    { baseUrl: 'https://ai.warp.at', apiKey: '', endpoint: '/v1/systemone', transport: 'relay', proxyMode: 'none', proxyUrl: '' },
    { state: 'x', questions: {}, checkpoint: 'auto', model: '' },
  )
  ok(headers['X-Relay-Proxy'] === '', "'none' sends an empty proxy header to force direct")

  // direct mode bypasses the relay entirely
  await sendSystemOne(
    { baseUrl: 'https://ai.warp.at', apiKey: '', endpoint: '/v1/systemone', transport: 'direct', proxyMode: 'auto', proxyUrl: '' },
    { state: 'x', questions: {}, checkpoint: 'auto', model: '' },
  )
  ok(url === 'https://ai.warp.at/v1/systemone', `direct mode posts straight to the endpoint (${url})`)
  ok(!headers['X-Relay-Target'] && !headers['X-Relay-Proxy'], 'direct mode sends no relay headers')

  globalThis.fetch = realFetch
}

// 7. checkpoint handling — live endpoint, skipped when offline
const key = process.env.LITELLM_API_KEY ?? ''
const settings = {
  baseUrl: process.env.LITELLM_BASE_URL || 'https://ai.warp.at',
  apiKey: key,
  endpoint: '/v1/systemone',
  // live tests talk to the endpoint straight from node, not through the relay
  transport: 'direct' as const,
  proxyMode: 'auto' as const,
  proxyUrl: '',
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
