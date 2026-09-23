import React, { useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Chip,
  Container,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material'
import ConfigPanel from './components/ConfigPanel'
import TemplatesPanel, { templateSummary } from './components/TemplatesPanel'
import UploadPanel from './components/UploadPanel'
import ResultsTable from './components/ResultsTable'
import Charts from './components/Charts'
import { CONFIG, DEFAULT_ENDPOINT } from './config'
import { findTemplate } from './templates'
import { questionsPayload, sendSystemOne } from './api'
import { extractAnswers, parseAnswer } from './parser'
import { aggregate } from './aggregate'
import type { ApiSettings, LineResult } from './types'

const CONCURRENCY = 4

export default function App() {
  const [settings, setSettings] = useState<ApiSettings>({
    baseUrl: CONFIG.baseUrl,
    apiKey: CONFIG.apiKey,
    model: CONFIG.model,
    endpoint: DEFAULT_ENDPOINT,
  })
  const [templateId, setTemplateId] = useState('mitre')
  const [fileName, setFileName] = useState('')
  const [lines, setLines] = useState<string[]>([])
  const [results, setResults] = useState<LineResult[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const raw = text.split(/\r?\n/)
      const trimmed = raw
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
      setLines(trimmed)
      setResults([])
    }
    reader.readAsText(file)
  }

  const analyze = async () => {
    setError(null)
    setRunning(true)
    const template = findTemplate(templateId)
    const questions = questionsPayload(template)
    const out: LineResult[] = []
    let idx = 0
    const total = lines.length
    setProgress({ done: 0, total })

    const worker = async () => {
      while (true) {
        const i = idx
        idx += 1
        if (i >= total) break
        const raw = lines[i]
        let state: string | Record<string, unknown>
        if (template.structuredInput) {
          try {
            state = JSON.parse(raw)
          } catch {
            state = raw
          }
        } else {
          state = raw
        }
        const res: LineResult = {
          line: i + 1,
          stateText: raw,
          ok: true,
          answers: [],
        }
        try {
          const payload = await sendSystemOne(settings, { state, questions })
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
      const template = findTemplate('mitre')
      const payload = await sendSystemOne(settings, {
        state: 'FIREWALL: blocked outbound connection from 10.30.2.7 to 185.220.101.44:4444 (TLS). Repeated every 5s for 10 minutes.',
        questions: questionsPayload(template),
      })
      const answers = extractAnswers(payload)
      const summary = Object.entries(answers)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ')
      alert(`Endpoint OK.\n\nanswers: ${summary || '(none parsed)'}\n\nraw: ${JSON.stringify(payload).slice(0, 400)}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Endpoint failed:\n${msg}`)
      setError(msg)
    }
  }

  const aggs = results.length ? aggregate(results, findTemplate(templateId).questions) : []
  const okCount = results.filter((r) => r.ok).length

  return (
    <Box>
      <AppBar position="static" color="inherit">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            System1 Analyzer
          </Typography>
          <Chip label={`model: ${settings.model}`} variant="outlined" />
          <Chip label={`${results.length} lines`} variant="outlined" />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Stack spacing={3}>
          <ConfigPanel settings={settings} onChange={setSettings} onConnectTest={connectTest} />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="stretch">
            <Box sx={{ flex: 1 }}>
              <TemplatesPanel selected={templateId} onSelect={setTemplateId} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <UploadPanel
                lines={lines.length}
                fileName={fileName}
                onFile={handleFile}
                onAnalyze={analyze}
                running={running}
                progress={progress}
              />
            </Box>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          {results.length > 0 && (
            <>
              <Paper sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Typography variant="h6">
                    Results — {templateSummary(findTemplate(templateId))}
                  </Typography>
                  <Chip color="success" label={`${okCount} ok`} />
                  <Chip color="error" label={`${results.length - okCount} failed`} />
                </Stack>
              </Paper>
              <Charts aggs={aggs} />
              <ResultsTable results={results} />
            </>
          )}
        </Stack>
      </Container>
    </Box>
  )
}
