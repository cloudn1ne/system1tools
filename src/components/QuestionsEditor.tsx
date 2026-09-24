import React, { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { questionsPayload } from '../api'
import { downloadText, questionToJson, slug, templateToJson } from '../io'
import { validateTemplate } from '../validation'
import { CHECKPOINTS } from '../types'
import type { Checkpoint, QuestionDef, TemplateDef } from '../types'

const CHECKPOINT_HINT: Record<Checkpoint, string> = {
  auto: 'Router picks per request by script/language (model field omitted)',
  english: 'ModernBERT-large — English only',
  multilingual: 'mmBERT-base — 100+ languages, faster',
  'typed-decisions': 'fine-tuned checkpoint — the four typed-decision workflows',
}

function defaultCriteria(type: QuestionDef['type']): QuestionDef['criteria'] {
  if (type === 'noul') return undefined
  if (type === 'score') return ['low', 'medium', 'high']
  return { a: '', b: '' }
}

/** criteria as ordered [key, description] pairs (choice) */
function pairsOf(criteria: QuestionDef['criteria']): [string, string][] {
  if (!criteria || Array.isArray(criteria)) return []
  return Object.entries(criteria).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])
}

function listOf(criteria: QuestionDef['criteria']): string[] {
  if (!criteria) return []
  if (Array.isArray(criteria)) return criteria.map((s) => String(s))
  return Object.keys(criteria)
}

export default function QuestionsEditor({
  template,
  onSave,
  onClose,
}: {
  template: TemplateDef
  onSave: (t: TemplateDef) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<TemplateDef>(() => structuredClone(template))
  const [copied, setCopied] = useState<string | null>(null)
  const issues = useMemo(() => validateTemplate(draft), [draft])

  const copyQuestion = (q: QuestionDef) => {
    const text = questionToJson(q)
    navigator.clipboard?.writeText(text).then(
      () => setCopied(q.id || '(unnamed)'),
      () => setCopied(null),
    )
  }

  const exportSelf = () => downloadText(`${slug(draft.label)}.json`, templateToJson(draft))

  const patch = (p: Partial<TemplateDef>) => setDraft((d) => ({ ...d, ...p }))

  const patchQuestion = (index: number, p: Partial<QuestionDef>) =>
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((q, i) => (i === index ? { ...q, ...p } : q)),
    }))

  const setType = (index: number, type: QuestionDef['type']) =>
    patchQuestion(index, { type, criteria: defaultCriteria(type), labels: undefined })

  const addQuestion = () =>
    setDraft((d) => ({
      ...d,
      questions: [
        ...d.questions,
        {
          id: `question_${d.questions.length + 1}`,
          type: 'noul' as const,
          instructions: '',
          criteria: defaultCriteria('noul'),
        },
      ],
    }))

  const removeQuestion = (index: number) =>
    setDraft((d) => ({ ...d, questions: d.questions.filter((_, i) => i !== index) }))

  const move = (index: number, delta: number) =>
    setDraft((d) => {
      const qs = [...d.questions]
      const j = index + delta
      if (j < 0 || j >= qs.length) return d
      ;[qs[index], qs[j]] = [qs[j], qs[index]]
      return { ...d, questions: qs }
    })

  // --- criteria editors -----------------------------------------------------

  const setPair = (i: number, slot: number, key: string, desc: string) => {
    const q = draft.questions[i]
    const pairs = pairsOf(q.criteria)
    pairs[slot] = [key, desc]
    const rec: Record<string, string> = {}
    for (const [k, v] of pairs) if (k.trim()) rec[k.trim()] = v
    patchQuestion(i, { criteria: rec })
  }

  const addPair = (i: number) => {
    const q = draft.questions[i]
    const rec = { ...((q.criteria ?? {}) as Record<string, string>) }
    let n = Object.keys(rec).length + 1
    while (rec[`option_${n}`] !== undefined) n += 1
    rec[`option_${n}`] = ''
    patchQuestion(i, { criteria: rec })
  }

  const removePair = (i: number, key: string) => {
    const q = draft.questions[i]
    const rec = { ...((q.criteria ?? {}) as Record<string, string>) }
    delete rec[key]
    patchQuestion(i, { criteria: rec })
  }

  const setList = (i: number, list: string[]) => patchQuestion(i, { criteria: list })

  const choiceAsList = (i: number) => setList(i, listOf(draft.questions[i].criteria))
  const choiceAsMap = (i: number) => {
    const rec: Record<string, string> = {}
    for (const name of listOf(draft.questions[i].criteria)) rec[name] = ''
    patchQuestion(i, { criteria: rec })
  }

  const hasErrors = issues.errors.length > 0

  return (
    <Dialog open fullWidth maxWidth="md" scroll="body" onClose={onClose}>
      <DialogTitle>Edit predefined questions</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Template name"
              size="small"
              value={draft.label}
              onChange={(e) => patch({ label: e.target.value })}
              sx={{ flex: 1 }}
            />
            <Tooltip title={CHECKPOINT_HINT[draft.checkpoint ?? 'auto']}>
              <Select
                size="small"
                value={draft.checkpoint ?? 'auto'}
                onChange={(e) => patch({ checkpoint: e.target.value as Checkpoint })}
                sx={{ minWidth: 190 }}
                renderValue={(v) => `checkpoint: ${v}`}
              >
                {CHECKPOINTS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </Tooltip>
          </Stack>

          <TextField
            label="Description"
            size="small"
            multiline
            minRows={1}
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={!!draft.structuredInput}
                onChange={(e) => patch({ structuredInput: e.target.checked })}
                size="small"
              />
            }
            label={
              <Typography variant="caption">
                JSON input — parse each line as an object so the state keeps its fields (email/ticket/JSON)
              </Typography>
            }
          />

          <Divider />

          {draft.questions.map((q, i) => (
            <Card key={i} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="answer key"
                    size="small"
                    value={q.id}
                    onChange={(e) => patchQuestion(i, { id: e.target.value })}
                    sx={{ width: 200 }}
                  />
                  <Select
                    size="small"
                    value={q.type}
                    onChange={(e) => setType(i, e.target.value as QuestionDef['type'])}
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value="noul">noul</MenuItem>
                    <MenuItem value="choice">choice</MenuItem>
                    <MenuItem value="score">score</MenuItem>
                  </Select>
                  <Box sx={{ flexGrow: 1 }} />
                  <Tooltip title="copy this question as JSON">
                    <IconButton size="small" onClick={() => copyQuestion(q)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="move up">
                    <IconButton size="small" onClick={() => move(i, -1)}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="move down">
                    <IconButton size="small" onClick={() => move(i, 1)}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" color="error" onClick={() => removeQuestion(i)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>

                <TextField
                  label="instructions"
                  size="small"
                  multiline
                  minRows={1}
                  fullWidth
                  value={q.instructions}
                  onChange={(e) => patchQuestion(i, { instructions: e.target.value })}
                />

                {/* ---- noul: true/false criteria + optional labels ---- */}
                {q.type === 'noul' && (
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      criteria is optional and may only be keyed true / false — those keys are the option
                      text the model reads. labels change the wording without changing P(true).
                    </Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        label="criteria.false"
                        size="small"
                        fullWidth
                        value={
                          q.criteria && !Array.isArray(q.criteria) ? String(q.criteria['false'] ?? '') : ''
                        }
                        onChange={(e) =>
                          patchQuestion(i, {
                            criteria: {
                              ...(q.criteria && !Array.isArray(q.criteria) ? q.criteria : {}),
                              false: e.target.value,
                            },
                          })
                        }
                      />
                      <TextField
                        label="criteria.true"
                        size="small"
                        fullWidth
                        value={
                          q.criteria && !Array.isArray(q.criteria) ? String(q.criteria['true'] ?? '') : ''
                        }
                        onChange={(e) =>
                          patchQuestion(i, {
                            criteria: {
                              ...(q.criteria && !Array.isArray(q.criteria) ? q.criteria : {}),
                              true: e.target.value,
                            },
                          })
                        }
                      />
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        label="labels.false"
                        size="small"
                        fullWidth
                        value={q.labels?.false ?? ''}
                        onChange={(e) =>
                          patchQuestion(i, { labels: { ...(q.labels ?? {}), false: e.target.value } })
                        }
                      />
                      <TextField
                        label="labels.true"
                        size="small"
                        fullWidth
                        value={q.labels?.true ?? ''}
                        onChange={(e) =>
                          patchQuestion(i, { labels: { ...(q.labels ?? {}), true: e.target.value } })
                        }
                      />
                    </Stack>
                  </Stack>
                )}

                {/* ---- choice: key/description map or plain list ---- */}
                {q.type === 'choice' && (
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        options
                      </Typography>
                      <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={Array.isArray(q.criteria) ? 'list' : 'map'}
                        onChange={(_, v) => (v === 'list' ? choiceAsList(i) : choiceAsMap(i))}
                      >
                        <Tooltip title="each option gets its own description">
                          <ToggleButton value="map" sx={{ px: 1 }}>
                            map
                          </ToggleButton>
                        </Tooltip>
                        <Tooltip title="option names only">
                          <ToggleButton value="list" sx={{ px: 1 }}>
                            list
                          </ToggleButton>
                        </Tooltip>
                      </ToggleButtonGroup>
                      <Box sx={{ flexGrow: 1 }} />
                      <Button size="small" startIcon={<AddIcon />} onClick={() => addPair(i)}>
                        option
                      </Button>
                    </Stack>

                    {Array.isArray(q.criteria) ? (
                      listOf(q.criteria).map((name, slot) => (
                        <Stack key={slot} direction="row" spacing={1} alignItems="center">
                          <TextField
                            size="small"
                            fullWidth
                            value={name}
                            onChange={(e) => {
                              const l = listOf(q.criteria)
                              l[slot] = e.target.value
                              setList(i, l)
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => setList(i, listOf(q.criteria).filter((_, k) => k !== slot))}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))
                    ) : (
                      pairsOf(q.criteria).map(([key, desc], slot) => (
                        <Stack key={`${key}-${slot}`} direction="row" spacing={1} alignItems="center">
                          <TextField
                            size="small"
                            sx={{ width: 210 }}
                            value={key}
                            onChange={(e) => setPair(i, slot, e.target.value, desc)}
                          />
                          <TextField
                            size="small"
                            fullWidth
                            placeholder="description (optional)"
                            value={desc}
                            onChange={(e) => setPair(i, slot, key, e.target.value)}
                          />
                          <IconButton size="small" onClick={() => removePair(i, key)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))
                    )}
                  </Stack>
                )}

                {/* ---- score: ordered ordinal levels ---- */}
                {q.type === 'score' && (
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        ordinal levels, weakest → strongest
                      </Typography>
                      <Box sx={{ flexGrow: 1 }} />
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setList(i, [...listOf(q.criteria), ''])}
                      >
                        level
                      </Button>
                    </Stack>
                    {listOf(q.criteria).map((level, slot) => (
                      <Stack key={slot} direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={slot} />
                        <TextField
                          size="small"
                          fullWidth
                          value={level}
                          onChange={(e) => {
                            const l = listOf(q.criteria)
                            l[slot] = e.target.value
                            setList(i, l)
                          }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => {
                            const l = listOf(q.criteria)
                            ;[l[slot], l[slot - 1]] = [l[slot - 1], l[slot]]
                            setList(i, l)
                          }}
                          disabled={slot === 0}
                        >
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const l = listOf(q.criteria)
                            ;[l[slot], l[slot + 1]] = [l[slot + 1], l[slot]]
                            setList(i, l)
                          }}
                          disabled={slot === listOf(q.criteria).length - 1}
                        >
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => setList(i, listOf(q.criteria).filter((_, k) => k !== slot))}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Card>
          ))}

          <Button startIcon={<AddIcon />} onClick={addQuestion} variant="outlined" size="small">
            Add question
          </Button>
          {copied && (
            <Typography variant="caption" color="text.secondary">
              copied question “{copied}” to the clipboard — paste it into any questions map to add it there
            </Typography>
          )}

          {issues.errors.length > 0 && (
            <Alert severity="error">
              {issues.errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </Alert>
          )}
          {issues.warnings.length > 0 && (
            <Alert severity="warning">
              {issues.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </Alert>
          )}

          <Box>
            <Typography variant="overline">Request payload preview</Typography>
            <Typography
              variant="caption"
              component="pre"
              sx={{ whiteSpace: 'pre-wrap', display: 'block', bgcolor: 'action.hover', p: 1, borderRadius: 1 }}
            >
              {JSON.stringify(questionsPayload(draft), null, 2)}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Tooltip title="download this set as JSON">
          <Button startIcon={<FileDownloadOutlinedIcon />} onClick={exportSelf}>
            Export this set
          </Button>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={hasErrors} onClick={() => onSave(draft)}>
          Save questions
        </Button>
      </DialogActions>
    </Dialog>
  )
}
