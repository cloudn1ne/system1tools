import React, { useRef } from 'react'
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreIcon from '@mui/icons-material/Restore'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import type { TemplateDef } from '../types'

export default function TemplatesPanel({
  templates,
  selected,
  onSelect,
  onNew,
  onEdit,
  onDuplicate,
  onDelete,
  onRestoreDefaults,
  onExportAll,
  onExport,
  onImportFile,
}: {
  templates: TemplateDef[]
  selected: string
  onSelect: (id: string) => void
  onNew: () => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onRestoreDefaults: () => void
  onExportAll: () => void
  onExport: (id: string) => void
  onImportFile: (file: File) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <Card>
      <CardHeader
        title="Predefined questions"
        subheader="SAMPLES templates + Laya's own presets — edit, add or import your own"
        action={
          <Stack direction="row" spacing={0.25}>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImportFile(f)
                e.target.value = ''
              }}
            />
            <Tooltip title="import a JSON file">
              <IconButton size="small" onClick={() => fileRef.current?.click()}>
                <FileUploadOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="export every set to one JSON file">
              <IconButton size="small" onClick={onExportAll}>
                <FileDownloadOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Restore the built-in set (drops custom edits)">
              <IconButton size="small" onClick={onRestoreDefaults}>
                <RestoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <RadioGroup value={selected} onChange={(e) => onSelect(e.target.value)}>
          <Stack spacing={0.5}>
            {templates.map((t) => (
              <Stack key={t.id} direction="row" alignItems="center" spacing={0.5}>
                <FormControlLabel
                  value={t.id}
                  control={<Radio />}
                  sx={{ mr: 0, flexGrow: 1, alignItems: 'flex-start' }}
                  label={
                    <Stack spacing={0.25} sx={{ py: 0.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{t.label}</Typography>
                        <Chip size="small" variant="outlined" label={`${t.questions.length}q`} />
                        {t.checkpoint && t.checkpoint !== 'auto' && (
                          <Chip size="small" color="secondary" variant="outlined" label={t.checkpoint} />
                        )}
                        {t.structuredInput && (
                          <Chip size="small" variant="outlined" label="JSON lines" />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {t.description}
                      </Typography>
                    </Stack>
                  }
                />
                <Tooltip title="export this set">
                  <IconButton size="small" onClick={() => onExport(t.id)}>
                    <FileDownloadOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="edit questions">
                  <IconButton size="small" onClick={() => onEdit(t.id)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="duplicate">
                  <IconButton size="small" onClick={() => onDuplicate(t.id)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="delete">
                  <IconButton size="small" color="error" onClick={() => onDelete(t.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        </RadioGroup>
        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onNew}>
            New question set
          </Button>
          <Button size="small" variant="text" startIcon={<FileUploadOutlinedIcon />} onClick={() => fileRef.current?.click()}>
            Import
          </Button>
        </Stack>
      </CardContent>
    </Card>
  )
}
