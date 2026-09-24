import type { AggregatedQuestion, LineResult, QuestionDef } from './types'

function labelForLevel(key: string, legend?: Record<string, string>): string {
  const desc = legend?.[key]
  return desc && desc.trim() ? desc.trim() : `level ${key}`
}

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
      meanScore: 0,
      levelCount: 0,
      buckets: [0, 0, 0, 0, 0],
      probs: [],
    }
    let probSum = 0
    let probN = 0
    let confSum = 0
    let confN = 0
    let scoreSum = 0
    let scoreN = 0
    const probAcc: Record<string, { sum: number; n: number }> = {}

    for (const line of lines) {
      if (!line.ok) continue
      const ans = line.answers.find((a) => a.questionId === q.id)
      if (!ans) continue
      agg.total += 1

      if (ans.confidence !== undefined) {
        confSum += ans.confidence
        confN += 1
      }

      if (q.type === 'noul' && ans.prob !== undefined) {
        const p = ans.prob
        probSum += p
        probN += 1
        agg.probs.push(p)
        if (p > 0.5) agg.yesCount += 1
        else agg.noCount += 1
        agg.buckets[Math.min(4, Math.max(0, Math.floor(p * 5)))] += 1
        continue
      }

      // ordinal: mean expected level + how often each level is the argmax
      if (q.type === 'score' && ans.score !== undefined) {
        scoreSum += ans.score
        scoreN += 1
        const dist = ans.probabilities ?? {}
        agg.levelCount = Math.max(agg.levelCount, Object.keys(dist).length)
        agg.counts[ans.value ?? '(unknown)'] = (agg.counts[ans.value ?? '(unknown)'] ?? 0) + 1
        for (const [k, p] of Object.entries(dist)) {
          const label = labelForLevel(k, ans.legend)
          const acc = probAcc[label] ?? { sum: 0, n: 0 }
          acc.sum += p
          acc.n += 1
          probAcc[label] = acc
        }
        continue
      }

      // choice (and anything else that answered with a label)
      const v = ans.value ?? '(unknown)'
      agg.counts[v] = (agg.counts[v] ?? 0) + 1
      for (const [opt, p] of Object.entries(ans.probabilities ?? {})) {
        const acc = probAcc[opt] ?? { sum: 0, n: 0 }
        acc.sum += p
        acc.n += 1
        probAcc[opt] = acc
      }
    }

    if (probN > 0) agg.meanProb = probSum / probN
    if (confN > 0) agg.meanConfidence = confSum / confN
    if (scoreN > 0) agg.meanScore = scoreSum / scoreN

    const avg: Record<string, number> = {}
    for (const [label, acc] of Object.entries(probAcc)) avg[label] = acc.sum / acc.n
    agg.avgProbs = avg

    out.push(agg)
  }
  return out
}

export function classifyYesNo(p: number): 'yes' | 'no' {
  return p > 0.5 ? 'yes' : 'no'
}
