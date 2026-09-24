/**
 * Component smoke test: renders real MUI components to static markup and
 * asserts structure. Complements logic.test.mts, which covers the pure
 * functions but never touches React. No jsdom here, so this checks the initial
 * render only - the interactive half lives in the pure functions.
 */
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ResultsTable from '../src/components/ResultsTable'
import type { LineResult, ParsedAnswer } from '../src/types'

let fails = 0
const ok = (c: boolean, m: string) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`)
  if (!c) fails++
}

const ans = (questionId: string, confidence: number): ParsedAnswer =>
  ({ questionId, type: 'noul', instructions: '', prob: 0.5, confidence }) as unknown as ParsedAnswer
const row = (line: number, list: ParsedAnswer[]): LineResult => ({ line, stateText: `line ${line}`, ok: true, answers: list })

const results: LineResult[] = [
  row(1, [ans('q1', 0.9), ans('q2', 0.2), ans('q3', 0.2)]),
  row(2, [ans('q1', 0.1), ans('q2', 0.1), ans('q3', 0.3)]),
]

const html = renderToStaticMarkup(React.createElement(ResultsTable, { results, confidenceGate: 0.35 }))
const count = (re: RegExp) => (html.match(re) ?? []).length

ok(html.length > 1000, `table rendered (${html.length} bytes of markup)`)
ok(/<input[^>]*type="checkbox"/.test(html), 'confidence filter renders as a checkbox input')
ok(/hide below gate/.test(html), 'checkbox is labelled')
ok(!/<input[^>]*type="checkbox"[^>]*checked/.test(html), 'unchecked by default, so nothing is hidden at first')
ok(!/hide below gate \(\d/.test(html), 'no hidden count shown while unchecked')
ok(/q1/.test(html) && /q2/.test(html) && /q3/.test(html), 'every question column present while unchecked')
// leading spacer cell + line + state + 3 questions + status = 7 (note the
// space, so <thead> is not counted as a cell)
ok(count(/<th /g) === 7, `header has one column per question (${count(/<th /g)} <th> cells)`)
ok(count(/<tr class=|<tr /g) >= 3, 'header plus both data rows rendered')
ok(/0\.9000|90%/.test(html), 'answer values reach the markup')

// a failing line still renders, with its error
const withError: LineResult[] = [{ line: 3, stateText: 'boom', ok: false, error: 'upstream 502', answers: [] }]
const html2 = renderToStaticMarkup(React.createElement(ResultsTable, { results: withError, confidenceGate: 0.35 }))
ok(/upstream 502/.test(html2), 'error rows show their message')
ok(!/q1/.test(html2), 'no question columns when nothing was answered')

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`)
process.exit(fails === 0 ? 0 : 1)
