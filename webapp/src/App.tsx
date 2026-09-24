import React, { useMemo, useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import ConfigPanel from './components/ConfigPanel'
import TemplatesPanel from './components/TemplatesPanel'
import QuestionsEditor from './components/QuestionsEditor'
import UploadPanel from './components/UploadPanel'
import ResultsTable from './components/ResultsTable'
import Charts from './components/Charts'
import { CONFIG, DEFAULT_ENDPOINT } from './config'
import { findTemplate, templateSummary } from './presets'
import { questionsPayload, sendSystemOne } from './api'
import { extractAnswers, parseAnswer } from './parser'
import { aggregate } from './aggregate'
import { validateTemplate } from './validation'
import { useTemplates } from './templatesStore'
import {
  downloadText,
  parseImport,
  readTextFile,
  slug,
  templateToJson,
  templatesToJson,
} from './io'
import type { ApiSettings, LineResult, TemplateDef } from './types'

const CONCURRENCY = 4

export default function App() {
  const { templates, create, update, remove, duplicate, restoreDefaults, merge } = useTemplates()
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [editorId, setEditorId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ severity: 'success' | 'info' | 'warning' | 'error'; text: string } | null>(
    null,
  )

  const [settings, setSettings] = useState<ApiSettings>({
    baseUrl: CONFIG.baseUrl,
    apiKey: CONFIG.apiKey,
    model: CONFIG.model,
    endpoint: DEFAULT_ENDPOINT,
    confidenceGate: 0.35,
    // relay by default: it works wherever the dev server can reach the
    // endpoint, including through a proxy, and needs no CORS exception
    transport: 'relay',
    proxyMode: 'auto',
    proxyUrl: '',
  })

  const [fileName, setFileName] = useState('')
  const [lines, setLines] = useState<string[]>([])
  /** null = every line (default) */
  const [lineLimit, setLineLimit] = useState<number | null>(null)
  const [results, setResults] = useState<LineResult[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const template = useMemo(() => findTemplate(templates, templateId), [templates, templateId])
  const editorTemplate = editorId ? templates.find((t) => t.id === editorId) : undefined
  const gate = validateTemplate(template)
  /** the slice actually sent: every line unless a limit is set */
  const targets = useMemo(
    () => (lineLimit && lineLimit > 0 ? lines.slice(0, lineLimit) : lines),
    [lines, lineLimit],
  )

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setLines(
        text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0),
      )
      setResults([])
    }
    reader.readAsText(file)
  }

  const analyze = async () => {
    setError(null)
    if (gate.errors.length) {
      setError(`Fix the questions first: ${gate.errors[0]}`)
      return
    }
    setRunning(true)

    const questions = questionsPayload(template)
    const checkpoint = template.checkpoint ?? 'auto'
    const out: LineResult[] = []
    let idx = 0
    const total = targets.length
    setProgress({ done: 0, total })

    const worker = async () => {
      for (;;) {
        const i = idx
        idx += 1
        if (i >= total) break
        const raw = targets[i]
        let state: string | Record<string, unknown> = raw
        if (template.structuredInput) {
          try {
            state = JSON.parse(raw)
          } catch {
            /* not JSON: send the raw line */
          }
        }
        const res: LineResult = { line: i + 1, stateText: raw, ok: true, answers: [] }
        try {
          const payload = await sendSystemOne(settings, { state, questions, checkpoint, model: settings.model })
          res.raw = payload
          const answersMap = extractAnswers(payload)
          for (const q of template.questions) {
            const rawAns = answersMap[q.id]
            if (rawAns !== undefined) res.answers.push(parseAnswer(q, rawAns))
          }
        } catch (e) {
          res.ok = false
          res.error = e instanceof Error ? e.message : String(e)
        }
        out[i] = res
        setProgress({ done: idx, total })
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()))
    setResults(out)
    setRunning(false)
  }

  const connectTest = async () => {
    setError(null)
    try {
      const payload = (await sendSystemOne({ ...settings }, {
        state: 'FIREWALL: blocked outbound connection from 10.30.2.7 to 185.220.101.44:4444 (TLS), repeated every 5s.',
        questions: questionsPayload(template),
        checkpoint: template.checkpoint ?? 'auto',
        model: settings.model,
      })) as { answers?: unknown; routing?: { model?: string; reason?: string } }
      const answers = extractAnswers(payload)
      const summary = Object.entries(answers)
        .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
        .join('\n')
      alert(
        `Endpoint OK.\ncheckpoint: ${JSON.stringify(payload?.routing?.model)} (${payload?.routing?.reason})\n\n${summary || '(none parsed)'}`,
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      alert(`Endpoint failed:\n${msg}`)
    }
  }

  const handleNew = () => {
    const id = create()
    if (id) setEditorId(id)
  }
  const handleDelete = (id: string) => {
    remove(id)
    if (templateId === id) setTemplateId(templates.find((t) => t.id !== id)?.id ?? '')
  }
  const handleDuplicate = (id: string) => {
    const newId = duplicate(id)
    if (newId) setEditorId(newId)
  }
  const handleSave = (t: (typeof templates)[number]) => {
    update(t.id, t)
    setEditorId(null)
    setTemplateId(t.id)
  }

  const handleExportAll = () => {
    downloadText(`system1-questions-${templates.length}-sets.json`, templatesToJson(templates))
    setNotice({ severity: 'success', text: `exported all ${templates.length} question sets to one JSON file` })
  }

  const handleExport = (id: string) => {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    downloadText(`${slug(t.label)}.json`, templateToJson(t))
    setNotice({ severity: 'success', text: `exported “${t.label}” (${t.questions.length} questions)` })
  }

  const handleImportFile = async (file: File) => {
    try {
      const { templates: incoming, notes } = parseImport(await readTextFile(file))
      const { added, updated } = merge(incoming)
      const parts = [
        added.length ? `${added.length} added (${added.map((t) => t.label).join(', ')})` : '',
        updated.length ? `${updated.length} replaced (${updated.map((t) => t.label).join(', ')})` : '',
        ...notes,
      ].filter(Boolean)
      setNotice({
        severity: notes.length ? 'warning' : 'success',
        text: `imported from ${file.name}: ${parts.join('; ') || 'nothing to do'}`,
      })
    } catch (e) {
      setNotice({ severity: 'error', text: e instanceof Error ? e.message : String(e) })
    }
  }

  const aggs = results.length ? aggregate(results, template.questions) : []
  const okCount = results.filter((r) => r.ok).length

  return (
    <Box>
      <AppBar position="static" color="inherit">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            System1 Analyzer
          </Typography>
          <Chip label={`checkpoint: ${template.checkpoint ?? 'auto'}`} variant="outlined" sx={{ mr: 1 }} />
          <Chip label={`${results.length} lines`} variant="outlined" />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 3, mb: 6 }}>
        <Stack spacing={3}>
          <ConfigPanel settings={settings} onChange={setSettings} onConnectTest={connectTest} />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TemplatesPanel
                templates={templates}
                selected={templateId}
                onSelect={setTemplateId}
                onNew={handleNew}
                onEdit={setEditorId}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onRestoreDefaults={restoreDefaults}
                onExportAll={handleExportAll}
                onExport={handleExport}
                onImportFile={handleImportFile}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <UploadPanel
                totalLines={lines.length}
                lineLimit={lineLimit}
                onLineLimit={setLineLimit}
                fileName={fileName}
                onFile={handleFile}
                onAnalyze={analyze}
                running={running}
                progress={progress}
              />
            </Box>
          </Stack>

          {gate.warnings.length > 0 && (
            <Alert severity="warning">
              {gate.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          {results.length > 0 && (
            <>
              <Paper sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <Typography variant="h6">{template.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {templateSummary(template)}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Chip color="success" label={`${okCount} ok`} />
                  <Chip color="error" label={`${results.length - okCount} failed`} />
                </Stack>
              </Paper>
              <Divider />
              <Charts aggs={aggs} />
              <ResultsTable results={results} confidenceGate={settings.confidenceGate} />
            </>
          )}
        </Stack>
      </Container>

      {editorTemplate && (
        <QuestionsEditor template={editorTemplate} onSave={handleSave} onClose={() => setEditorId(null)} />
      )}

      <Snackbar
        open={!!notice}
        autoHideDuration={7000}
        onClose={() => setNotice(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={notice?.severity ?? 'info'} onClose={() => setNotice(null)} sx={{ maxWidth: '80vw' }}>
          {notice?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}
