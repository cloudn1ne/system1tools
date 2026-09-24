import React, { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableSortLabel,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import type { LineResult, ParsedAnswer, QuestionType } from '../types'

type SortKey = 'line' | 'state' | 'status' | string // string = questionId
type Dir = 'asc' | 'desc'
type StatusFilter = 'all' | 'ok' | 'error'

/** Sortable value for a question column. */
function answerSortValue(ans: ParsedAnswer | undefined): number | string | null {
  if (!ans) return null
  if (ans.prob !== undefined) return ans.prob
  if (ans.score !== undefined) return ans.score
  if (ans.probabilities) return Math.max(...Object.values(ans.probabilities))
  if (ans.value !== undefined) return ans.value.toLowerCase()
  return null
}

function cmp(a: number | string | null, b: number | string | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1 // nulls last
  if (b === null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'number') return -1
  if (typeof b === 'number') return 1
  return String(a).localeCompare(String(b))
}

function probColor(p: number): 'error' | 'warning' | 'success' {
  if (p > 0.66) return 'error'
  if (p > 0.33) return 'warning'
  return 'success'
}

function AnswerChip({ ans, gate }: { ans: ParsedAnswer; gate: number }) {
  const low = ans.confidence !== undefined && ans.confidence < gate
  const conf = ans.confidence !== undefined ? `confidence ${(ans.confidence * 100).toFixed(0)}%` : ''

  if (ans.prob !== undefined) {
    return (
      <Tooltip title={conf}>
        <Chip
          size="small"
          label={
            ans.confidence !== undefined
              ? `${(ans.prob * 100).toFixed(0)}% (conf ${(ans.confidence * 100).toFixed(0)}%)`
              : `${(ans.prob * 100).toFixed(0)}%`
          }
          color={low ? 'warning' : ans.prob > 0.5 ? 'error' : 'success'}
        />
      </Tooltip>
    )
  }

  // ordinal: show the expected level next to the most probable level's description
  if (ans.score !== undefined) {
    return (
      <Tooltip title={`expected level ${ans.score.toFixed(3)}${conf ? ` · ${conf}` : ''}`}>
        <Chip
          size="small"
          label={`${ans.value ?? '?'} · ${ans.score.toFixed(2)}`}
          color={low ? 'warning' : 'primary'}
          variant={low ? 'filled' : 'outlined'}
        />
      </Tooltip>
    )
  }

  return <Chip size="small" label={ans.value ?? '?'} color={low ? 'warning' : 'default'} />
}

function ProbBars({ ans }: { ans: ParsedAnswer }) {
  if (!ans.probabilities) return null
  const entries = Object.entries(ans.probabilities).sort((a, b) => b[1] - a[1])
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      {entries.map(([k, v]) => (
        <Stack key={k} direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ width: 210, flexShrink: 0 }}>
            {ans.legend?.[k] ?? k}
          </Typography>
          <Box
            sx={{
              height: 10,
              width: `${Math.round(v * 100)}%`,
              minWidth: 2,
              bgcolor: 'primary.main',
              borderRadius: 0.5,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {(v * 100).toFixed(1)}%
          </Typography>
        </Stack>
      ))}
    </Stack>
  )
}

function DetailDialog({
  row,
  types,
  gate,
  onClose,
}: {
  row: LineResult | null
  types: Record<string, QuestionType>
  gate: number
  onClose: () => void
}) {
  return (
    <Dialog open={!!row} onClose={onClose} maxWidth="md" fullWidth scroll="body">
      {row && (
        <>
          <DialogTitle>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">Line {row.line}</Typography>
              <Chip size="small" color={row.ok ? 'success' : 'error'} label={row.ok ? 'ok' : 'error'} />
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Box>
                <Typography variant="overline">State (full line)</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {row.stateText}
                </Typography>
              </Box>

              {!row.ok && (
                <Box>
                  <Typography variant="overline" color="error.main">
                    Error
                  </Typography>
                  <Typography variant="body2" color="error.main">
                    {row.error ?? 'request failed'}
                  </Typography>
                </Box>
              )}

              <Divider />

              {row.answers.map((a) => (
                <Box key={a.questionId}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="overline">{a.questionId}</Typography>
                    <Chip size="small" variant="outlined" label={types[a.questionId] ?? a.type} />
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                    {a.prob !== undefined && (
                      <Chip size="small" label={`P(true) = ${a.prob.toFixed(4)}`} color={probColor(a.prob)} />
                    )}
                    {a.score !== undefined && (
                      <Chip
                        size="small"
                        color="primary"
                        label={`level ${a.score.toFixed(4)}${a.value ? ` → ${a.value}` : ''}`}
                      />
                    )}
                    {a.score === undefined && a.prob === undefined && (
                      <Chip size="small" label={`answer: ${a.value ?? '(none)'}`} color="primary" />
                    )}
                    {a.confidence !== undefined && (
                      <Chip
                        size="small"
                        color={a.confidence < gate ? 'warning' : 'default'}
                        variant="outlined"
                        label={`confidence ${a.confidence.toFixed(4)}${a.confidence < gate ? ' · below gate' : ''}`}
                      />
                    )}
                  </Stack>
                  <ProbBars ans={a} />
                  <Typography variant="caption" color="text.secondary" component="pre" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', display: 'block' }}>
                    {JSON.stringify(a.raw, null, 2)}
                  </Typography>
                </Box>
              ))}

              <Divider />
              <Box>
                <Typography variant="overline">Raw response (model, routing, usage)</Typography>
                <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block' }}>
                  {row.raw !== undefined ? JSON.stringify(row.raw, null, 2) : '(no raw payload stored)'}
                </Typography>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Close</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

export default function ResultsTable({
  results,
  confidenceGate = 0,
}: {
  results: LineResult[]
  confidenceGate?: number
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('line')
  const [dir, setDir] = useState<Dir>('asc')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [detail, setDetail] = useState<LineResult | null>(null)

  const questionIds = useMemo(
    () => (results.length ? Array.from(new Set(results.flatMap((r) => r.answers.map((a) => a.questionId)))) : []),
    [results],
  )
  const types = useMemo(() => {
    const t: Record<string, QuestionType> = {}
    for (const r of results) for (const a of r.answers) t[a.questionId] = a.type
    return t
  }, [results])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return results.filter((r) => {
      if (status === 'ok' && !r.ok) return false
      if (status === 'error' && r.ok) return false
      if (!q) return true
      if (r.stateText.toLowerCase().includes(q)) return true
      if (String(r.line) === q) return true
      return r.answers.some(
        (a) => a.questionId.toLowerCase().includes(q) || (a.value ?? '').toLowerCase().includes(q),
      )
    })
  }, [results, query, status])

  const sorted = useMemo(() => {
    const val = (r: LineResult): number | string | null => {
      if (sortKey === 'line') return r.line
      if (sortKey === 'state') return r.stateText.toLowerCase()
      if (sortKey === 'status') return r.ok ? 0 : 1
      return answerSortValue(r.answers.find((a) => a.questionId === sortKey))
    }
    const mul = dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => cmp(val(a), val(b)) * mul)
  }, [filtered, sortKey, dir])

  const paged = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDir(dir === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setDir(key === 'line' ? 'asc' : 'desc')
    }
    setPage(0)
  }

  return (
    <Paper sx={{ width: '100%' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ p: 2 }} alignItems={{ md: 'center' }}>
        <TextField
          size="small"
          placeholder="Filter lines (state text, answer, line #)…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
          }}
          sx={{ flexGrow: 1, minWidth: 260 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={status}
          onChange={(_, v) => {
            if (v) {
              setStatus(v)
              setPage(0)
            }
          }}
        >
          <ToggleButton value="all">all ({results.length})</ToggleButton>
          <ToggleButton value="ok">ok ({results.filter((r) => r.ok).length})</ToggleButton>
          <ToggleButton value="error">failed ({results.filter((r) => !r.ok).length})</ToggleButton>
        </ToggleButtonGroup>
        <Select size="small" value={sortKey} onChange={(e) => toggleSort(e.target.value as SortKey)} sx={{ minWidth: 170 }}>
          <MenuItem value="line">sort: line #</MenuItem>
          <MenuItem value="state">sort: state</MenuItem>
          <MenuItem value="status">sort: status</MenuItem>
          {questionIds.map((q) => (
            <MenuItem key={q} value={q}>
              sort: {q}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <TableContainer sx={{ maxHeight: 560, overflowX: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              {(['line', 'state', ...questionIds, 'status'] as SortKey[]).map((key) => (
                <TableCell
                  key={key}
                  align={key === 'state' ? 'left' : key === 'line' ? 'left' : 'center'}
                  sortDirection={sortKey === key ? dir : false}
                >
                  <TableSortLabel
                    active={sortKey === key}
                    direction={sortKey === key ? dir : 'asc'}
                    onClick={() => toggleSort(key)}
                  >
                    {key === 'line' ? '#' : key === 'state' ? 'State' : key === 'status' ? 'Status' : key}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((r) => (
              <TableRow
                key={r.line}
                hover
                onClick={() => setDetail(r)}
                sx={{ cursor: 'pointer', '&:hover td': { bgcolor: 'action.hover' } }}
              >
                <TableCell sx={{ width: 40, pr: 0 }}>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDetail(r) }}>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </TableCell>
                <TableCell sx={{ width: 50 }}>{r.line}</TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {r.stateText.slice(0, 80)}
                    {r.stateText.length > 80 ? '…' : ''}
                  </Typography>
                </TableCell>
                {questionIds.map((q) => {
                  const ans = r.answers.find((a) => a.questionId === q)
                  return (
                    <TableCell key={q} align="center">
                      {ans ? <AnswerChip ans={ans} gate={confidenceGate} /> : '—'}
                    </TableCell>
                  )
                })}
                <TableCell align="center">
                  <Chip size="small" color={r.ok ? 'success' : 'error'} label={r.ok ? 'ok' : r.error ?? 'err'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10))
          setPage(0)
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />

      <DetailDialog row={detail} types={types} gate={confidenceGate} onClose={() => setDetail(null)} />
    </Paper>
  )
}
