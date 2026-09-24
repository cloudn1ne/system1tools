import type { QuestionDef, TemplateDef } from './types'

/**
 * Built-in templates, seeded into localStorage on first run and editable from the UI.
 *
 * The first four are the request shapes from the system1 repo SAMPLES.md.
 * The last five are Laya's own workflow presets, transcribed from
 * https://github.com/NandhaKishorM/laya/blob/main/laya/presets.py
 */
export const BUILTIN_TEMPLATES: TemplateDef[] = [
  {
    id: 'mitre',
    label: 'MITRE ATT&CK Analyzer',
    description: 'Classify each line against MITRE ATT&CK tactics; decide whether to isolate the host.',
    builtin: true,
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
      { id: 'act', type: 'noul', instructions: 'Should the source host be isolated automatically?' },
    ],
  },
  {
    id: 'triage-samples',
    label: 'Single-question triage (SAMPLES)',
    description: 'Brute-force / credential-stuffing indicator per line.',
    builtin: true,
    questions: [
      {
        id: 'suspicious',
        type: 'noul',
        instructions: 'Is this a sign of a brute-force or credential-stuffing attack?',
      },
    ],
  },
  {
    id: 'multi-samples',
    label: 'Multi-question triage (SAMPLES)',
    description: 'Severity score, attack indicator and escalate decision in one pass.',
    builtin: true,
    questions: [
      {
        id: 'severity',
        type: 'score',
        instructions: 'Rate the severity of this event.',
        criteria: ['informational', 'low', 'medium', 'high', 'critical'],
      },
      { id: 'is_attack', type: 'noul', instructions: 'Does this event indicate active malicious activity?' },
      { id: 'escalate', type: 'noul', instructions: 'Should this be escalated to a human analyst now?' },
    ],
  },
  {
    id: 'phishing-samples',
    label: 'Email / phishing preanalysis (SAMPLES)',
    description: 'Structured JSON events: phishing likelihood and confidence.',
    builtin: true,
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
  {
    id: 'preset-triage',
    label: 'Laya preset: support ticket triage',
    description: 'laya.triage_questions() — intent, urgency, frustration, refund and churn risk.',
    builtin: true,
    questions: [
      {
        id: 'intent',
        type: 'choice',
        instructions: 'What does the customer want in `message`?',
        criteria: {
          refund: 'money returned or a duplicate charge reversed',
          technical_help: 'a bug, outage or integration problem',
          billing_question: 'a question about an invoice, plan or payment method',
          information: 'general information, pricing or how-to',
          cancellation: 'wants to cancel or downgrade',
          other: 'none of the other options fits',
        },
      },
      {
        id: 'is_urgent',
        type: 'noul',
        instructions: 'Does `message` communicate time pressure or a deadline?',
      },
      {
        id: 'frustration',
        type: 'score',
        instructions: 'How frustrated does the customer sound in `message`?',
        criteria: [
          'calm and neutral',
          'concerned but civil',
          'clearly annoyed',
          'very angry or using strong language',
        ],
      },
      { id: 'refund_requested', type: 'noul', instructions: 'Does the customer ask for money back?' },
      {
        id: 'churn_risk',
        type: 'noul',
        instructions: 'Does `message` suggest the customer may leave for a competitor or cancel?',
      },
    ],
  },
  {
    id: 'preset-email',
    label: 'Laya preset: inbound email triage',
    description: 'laya.email_questions() — routing, spam, phishing, urgency, reply expectation.',
    builtin: true,
    structuredInput: true,
    questions: [
      {
        id: 'category',
        type: 'choice',
        instructions: 'Which team should handle the email in `body`?',
        criteria: {
          billing: 'invoices, payments, refunds',
          technical: 'bugs, outages, integrations',
          sales: 'pricing, demos, new purchases',
          security: 'phishing, scams, account compromise',
          hr: 'hiring, leave, payroll',
          other: 'none of the above',
        },
      },
      {
        id: 'is_spam',
        type: 'noul',
        instructions: 'Is this email unsolicited spam or bulk marketing?',
      },
      {
        id: 'is_phishing',
        type: 'noul',
        instructions:
          'Is this email a phishing or scam attempt to steal money, credentials, or personal data?',
        criteria: { true: 'phishing, scam, or fraud', false: 'a legitimate email' },
      },
      {
        id: 'urgency',
        type: 'score',
        instructions: 'How urgent is the request in `body`?',
        criteria: ['no time pressure', 'needs attention soon', 'blocking issue or hard deadline'],
      },
      { id: 'needs_reply', type: 'noul', instructions: 'Does the sender expect a reply?' },
    ],
  },
  {
    id: 'preset-guard',
    label: 'Laya preset: prompt guardrails',
    description: 'laya.guard_questions() — jailbreak, injection, sensitive data, harm severity, topic.',
    builtin: true,
    questions: [
      {
        id: 'jailbreak',
        type: 'noul',
        instructions:
          'Does `prompt` try to make an AI assistant ignore its rules, policies or system instructions?',
      },
      {
        id: 'prompt_injection',
        type: 'noul',
        instructions:
          'Does `prompt` contain instructions aimed at the AI system rather than a genuine user request?',
      },
      {
        id: 'sensitive_data',
        type: 'noul',
        instructions: 'Does `prompt` contain credentials, personal data or other sensitive information?',
      },
      {
        id: 'harm_severity',
        type: 'score',
        instructions: 'How much harm would complying with `prompt` cause?',
        criteria: [
          'none: ordinary request',
          'minor: mildly inappropriate',
          'serious: unsafe advice or abuse',
          'severe: dangerous or illegal',
        ],
      },
      {
        id: 'topic',
        type: 'choice',
        instructions: 'What is `prompt` about?',
        criteria: {
          product_support: null,
          coding: null,
          general_knowledge: null,
          personal_advice: null,
          security_testing: null,
          other: null,
        },
      },
    ],
  },
  {
    id: 'preset-moderation',
    label: 'Laya preset: content moderation',
    description: 'laya.moderation_questions() — toxicity, harassment, threats, spam, severity.',
    builtin: true,
    questions: [
      {
        id: 'toxic',
        type: 'noul',
        instructions: 'Is `post` toxic: rude, disrespectful or likely to make someone leave the discussion?',
      },
      { id: 'harassment', type: 'noul', instructions: 'Does `post` target or harass a specific person?' },
      { id: 'threat', type: 'noul', instructions: 'Does `post` threaten violence, harm or intimidation?' },
      { id: 'spam', type: 'noul', instructions: 'Is `post` spam or advertising?' },
      {
        id: 'severity',
        type: 'score',
        instructions: 'How severe is any rule-breaking in `post`?',
        criteria: [
          'no rule-breaking: ordinary on-topic post',
          'mild: rude tone or off-topic, no target',
          'clear violation: insults, harassment or spam aimed at someone',
          'severe: threats, hate speech or calls for violence',
        ],
      },
    ],
  },
  {
    id: 'preset-router',
    label: 'Laya preset: model router',
    description: 'laya.router_questions() — difficulty, domain, tools, sensitivity.',
    builtin: true,
    questions: [
      {
        id: 'difficulty',
        type: 'score',
        instructions: 'How hard is `request` for a language model?',
        criteria: [
          'trivial: a lookup or one-liner',
          'easy: short answer, no reasoning',
          'moderate: several steps',
          'hard: long multi-step reasoning or specialist knowledge',
        ],
      },
      {
        id: 'domain',
        type: 'choice',
        instructions: 'What domain does `request` belong to?',
        criteria: {
          code: 'software engineering, programming, refactoring, architecture, debugging',
          math_or_logic: 'mathematics, logic puzzles, proofs, complex calculation',
          writing: 'creative writing, essays, emails, blog posts, copywriting',
          factual_lookup: 'facts, definitions, trivia, history',
          data_analysis: 'statistics, SQL, data manipulation, metrics',
          chitchat: 'casual conversation, greetings, small talk',
        },
      },
      {
        id: 'needs_tools',
        type: 'noul',
        instructions: 'Does answering `request` require external tools, search or private data?',
      },
      {
        id: 'is_sensitive',
        type: 'noul',
        instructions: 'Does `request` involve money, legal, medical or safety consequences?',
      },
    ],
  },
]

export function findTemplate(list: TemplateDef[], id: string): TemplateDef {
  return list.find((t) => t.id === id) ?? list[0]
}

export function templateSummary(t: TemplateDef): string {
  return t.questions.map((q) => `${q.id}:${q.type}`).join(' · ')
}

export function blankQuestion(n: number): QuestionDef {
  return {
    id: `question_${n}`,
    type: 'noul',
    instructions: '',
  }
}

export function blankTemplate(n: number): TemplateDef {
  return {
    id: `custom_${Date.now().toString(36)}_${n}`,
    label: `My template ${n}`,
    description: '',
    checkpoint: 'auto',
    builtin: false,
    questions: [blankQuestion(1)],
  }
}
