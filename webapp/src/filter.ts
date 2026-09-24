import type { LineResult, ParsedAnswer } from './types'

/**
 * The detail list can hide the results the confidence gate already considers
 * unreliable. Pure so it is testable outside React.
 */

/** True when the answer's own confidence sits under the gate. */
export function isBelowGate(ans: ParsedAnswer | undefined, gate: number): boolean {
  return !!ans && ans.confidence !== undefined && ans.confidence < gate
}

/**
 * Question columns to show. When enabled, a question that not *any* line
 * answered confidently disappears entirely; one that at least one line
 * answered confidently stays, and only its weak cells go blank.
 */
export function visibleQuestions(
  results: LineResult[],
  all: string[],
  gate: number,
  enabled: boolean,
): string[] {
  if (!enabled) return all
  return all.filter((q) => results.some((r) => !isBelowGate(r.answers.find((a) => a.questionId === q), gate)))
}

/** How many answer cells the filter hides across these rows (for the label). */
export function countHiddenCells(results: LineResult[], gate: number, enabled: boolean): number {
  if (!enabled) return 0
  return results.reduce((n, r) => n + r.answers.filter((a) => isBelowGate(a, gate)).length, 0)
}
