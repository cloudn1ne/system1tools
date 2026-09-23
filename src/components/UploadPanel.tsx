import React, { useRef, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { MAX_FILE_BYTES } from '../config'

export default function UploadPanel({
  lines,
  fileName,
  onFile,
  onAnalyze,
  running,
  progress,
}: {
  lines: number
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
          <Stack direction="row" spacing={1}>
            <Chip label={`${lines} lines`} color="primary" variant="outlined" />
            <Chip label={fileName || 'no file'} variant="outlined" />
          </Stack>
          <Button
            variant="contained"
            color="secondary"
            disabled={running || lines === 0}
            onClick={onAnalyze}
          >
            {running ? 'Analyzing…' : 'Analyze all lines'}
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
