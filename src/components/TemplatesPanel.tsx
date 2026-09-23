import React from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material'
import { TEMPLATES } from '../templates'
import type { TemplateDef } from '../types'

export default function TemplatesPanel({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader title="Questions template" subheader="Transcribed from system1 SAMPLES.md" />
      <CardContent>
        <RadioGroup value={selected} onChange={(_, v) => onSelect(v)}>
          <Stack spacing={1}>
            {TEMPLATES.map((t) => (
              <FormControlLabel
                key={t.id}
                value={t.id}
                control={<Radio />}
                label={
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography variant="body1">{t.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.description}
                    </Typography>
                  </Stack>
                }
              />
            ))}
          </Stack>
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

export function templateSummary(t: TemplateDef): string {
  return t.questions.map((q) => `${q.id}:${q.type}`).join(' · ')
}
