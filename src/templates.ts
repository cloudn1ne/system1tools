import type { TemplateDef } from './types'

// Templates transcribed from the system1 repo SAMPLES.md (/v1/systemone contract).
export const TEMPLATES: TemplateDef[] = [
  {
    id: 'mitre',
    label: 'MITRE ATT&CK Analyzer',
    description: 'Classify each line against MITRE ATT&CK tactics and decide whether to isolate the source host.',
    questions: [
      {
        id: 'category',
        type: 'choice',
        instructions: 'Classify the likely MITRE ATT&CK tactic of this outbound beaconing.',
        criteria: {
          'command-and-control': 'regular outbound callbacks to a suspicious external host',
          exfiltration: 'bulk transfer of internal data to an external destination',
          'lateral-movement': 'access attempts to other internal hosts',
          reconnaissance: 'scanning or probing of internal or external targets',
          benign: 'normal expected network behaviour',
        },
      },
      {
        id: 'act',
        type: 'noul',
        instructions: 'Should the source host be isolated automatically?',
      },
    ],
  },
  {
    id: 'triage',
    label: 'Single-question triage',
    description: 'Ask whether each log line is suspicious.',
    questions: [
      {
        id: 'suspicious',
        type: 'noul',
        instructions: 'Is this a sign of a brute-force or credential-stuffing attack?',
      },
    ],
  },
  {
    id: 'multi',
    label: 'Multi-question triage',
    description: 'Severity rating, attack indicator, and escalate decision.',
    questions: [
      {
        id: 'severity',
        type: 'score',
        instructions: 'Rate the severity of this event.',
        criteria: ['informational', 'low', 'medium', 'high', 'critical'],
      },
      {
        id: 'is_attack',
        type: 'noul',
        instructions: 'Does this event indicate active malicious activity?',
      },
      {
        id: 'escalate',
        type: 'noul',
        instructions: 'Should this be escalated to a human analyst now?',
      },
    ],
  },
  {
    id: 'phishing',
    label: 'Email / phishing preanalysis',
    description: 'Structured JSON events: phishing likelihood and confidence.',
    structuredInput: true,
    questions: [
      {
        id: 'phishing',
        type: 'noul',
        instructions: 'Is this a phishing or business-email-compromise attempt?',
      },
      {
        id: 'confidence',
        type: 'score',
        instructions: 'How confident are you that this email is malicious?',
        criteria: ['low', 'medium', 'high'],
      },
    ],
  },
]

export function findTemplate(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}
