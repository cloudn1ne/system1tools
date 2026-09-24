import React from 'react'
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
}: {
  templates: TemplateDef[]
  selected: string
  onSelect: (id: string) => void
  onNew: () => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onRestoreDefaults: () => void
}) {
  return (
    <Card>
      <CardHeader
        title="Predefined questions"
        subheader="SAMPLES templates + Laya's own presets — edit or add your own"
        action={
          <Tooltip title="Restore the built-in set (drops custom edits)">
            <IconButton size="small" onClick={onRestoreDefaults}>
              <RestoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onNew}>
          New question set
        </Button>
      </CardContent>
    </Card>
  )
}
