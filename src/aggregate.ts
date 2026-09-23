import type { AggregatedQuestion, LineResult, QuestionDef } from './types'

export function aggregate(lines: LineResult[], questions: QuestionDef[]): AggregatedQuestion[] {
  const out: AggregatedQuestion[] = []

  for (const q of questions) {
    const agg: AggregatedQuestion = {
      id: q.id,
      type: q.type,
      instructions: q.instructions,
      total: 0,
      yesCount: 0,
      noCount: 0,
      meanProb: 0,
      meanConfidence: 0,
      counts: {},
      avgProbs: {},
      buckets: [0, 0, 0, 0, 0],
      probs: [],
    }
    let probSum = 0
    let probN = 0
    let confSum = 0
    let confN = 0
    const probAcc: Record<string, { sum: number; n: number }> = {}

    for (const line of lines) {
      if (!line.ok) continue
      const ans = line.answers.find((a) => a.questionId === q.id)
      if (!ans) continue
      agg.total += 1

      if (q.type === 'noul' && ans.prob !== undefined) {
        const p = ans.prob
        probSum += p
        probN += 1
        agg.probs.push(p)
        if (p > 0.5) agg.yesCount += 1
        else agg.noCount += 1
        const bi = Math.min(4, Math.max(0, Math.floor(p * 5)))
        agg.buckets[bi] += 1
        if (ans.confidence !== undefined) {
          confSum += ans.confidence
          confN += 1
        }
      } else {
        const v = ans.value ?? '(unknown)'
        agg.counts[v] = (agg.counts[v] ?? 0) + 1
        if (ans.probabilities) {
          for (const [opt, p] of Object.entries(ans.probabilities)) {
            const acc = probAcc[opt] ?? { sum: 0, n: 0 }
            acc.sum += p
            acc.n += 1
            probAcc[opt] = acc
          }
        }
      }
    }

    if (probN > 0) agg.meanProb = probSum / probN
    if (confN > 0) agg.meanConfidence = confSum / confN
    const avg: Record<string, number> = {}
    for (const [opt, acc] of Object.entries(probAcc)) avg[opt] = acc.sum / acc.n
    agg.avgProbs = avg
    out.push(agg)
  }
  return out
}

export function classifyYesNo(p: number): 'yes' | 'no' {
  return p > 0.5 ? 'yes' : 'no'
}
