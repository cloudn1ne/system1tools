import React, { useRef, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { MAX_FILE_BYTES } from '../config'

const PRESETS = [10, 50, 100, 500]

export default function UploadPanel({
  totalLines,
  lineLimit,
  onLineLimit,
  fileName,
  onFile,
  onAnalyze,
  running,
  progress,
}: {
  totalLines: number
  /** null = analyse every line (default) */
  lineLimit: number | null
  onLineLimit: (n: number | null) => void
  fileName: string
  onFile: (file: File) => void
  onAnalyze: () => void
  running: boolean
  progress: { done: number; total: number }
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePick = (f: File | null) => {
    if (!f) return
    if (f.size > MAX_FILE_BYTES) {
      setError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB — max is 10 MB.`)
      return
    }
    setError(null)
    onFile(f)
  }

  const limited = lineLimit !== null
  const planned = limited ? Math.min(lineLimit, totalLines) : totalLines
  const skipped = Math.max(0, totalLines - planned)
  const pct = progress.total ? (progress.done / progress.total) * 100 : 0

  return (
    <Card>
      <CardHeader title="Input file" subheader="Each non-empty line becomes one `state`; JSON lines are sent as structured events" />
      <CardContent>
        <Stack spacing={2}>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.log,.jsonl,.json,.csv"
            hidden
            onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
          />
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            disabled={running}
            onClick={() => inputRef.current?.click()}
          >
            {fileName || 'Choose file (≤ 10 MB)'}
          </Button>
          {error && <Typography color="error">{error}</Typography>}

          {/* how many of the loaded lines to send */}
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={limited}
                    onChange={(e) => onLineLimit(e.target.checked ? Math.min(50, Math.max(1, totalLines)) : null)}
                  />
                }
                label={<Typography variant="body2">limit lines</Typography>}
                sx={{ mr: 0 }}
              />
              <TextField
                size="small"
                type="number"
                disabled={!limited}
                value={limited ? String(lineLimit) : ''}
                placeholder="all"
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  onLineLimit(Number.isFinite(n) && n > 0 ? n : null)
                }}
                inputProps={{ min: 1, style: { width: 78 } }}
              />
              {PRESETS.map((n) => (
                <Tooltip key={n} title={`analyse the first ${n} lines`}>
                  <Chip
                    size="small"
                    label={n}
                    variant={lineLimit === n ? 'filled' : 'outlined'}
                    color={lineLimit === n ? 'primary' : 'default'}
                    onClick={() => onLineLimit(n)}
                  />
                </Tooltip>
              ))}
            </Stack>
            <Typography variant="caption" color={skipped ? 'warning.main' : 'text.secondary'}>
              {totalLines === 0
                ? 'no lines loaded'
                : limited
                  ? `analysing the first ${planned} of ${totalLines} lines${skipped ? ` — ${skipped} skipped` : ' (limit covers the whole file)'}`
                  : `analysing all ${totalLines} line${totalLines === 1 ? '' : 's'}`}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Chip label={`${planned} of ${totalLines} lines`} color="primary" variant="outlined" />
            <Chip label={fileName || 'no file'} variant="outlined" />
          </Stack>
          <Button
            variant="contained"
            color="secondary"
            disabled={running || planned === 0}
            onClick={onAnalyze}
          >
            {running ? 'Analysing…' : `Analyse ${planned} line${planned === 1 ? '' : 's'}`}
          </Button>
          {running && (
            <Stack spacing={1}>
              <LinearProgress variant="determinate" value={pct} />
              <Typography variant="caption">
                {progress.done} / {progress.total} lines
              </Typography>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}
