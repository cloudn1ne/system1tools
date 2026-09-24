import React, { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import type { ApiSettings, ProxyMode, Transport } from '../types'
import { CONFIG, DEFAULT_ENDPOINT, RELAY } from '../config'

export default function ConfigPanel({
  settings,
  onChange,
  onConnectTest,
}: {
  settings: ApiSettings
  onChange: (s: ApiSettings) => void
  onConnectTest: () => void
}) {
  const [endpoint, setEndpoint] = useState(settings.endpoint || DEFAULT_ENDPOINT)

  return (
    <Card>
      <CardHeader
        title="LiteLLM endpoint"
        subheader="Defaults injected from .env (LITELLM_API_KEY / BASE_URL / MODEL)"
        action={
          <Tooltip title="Send a minimal ping to the endpoint">
            <IconButton color="primary" onClick={onConnectTest}>
              <PlayArrowIcon />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent>
        <Stack spacing={2}>
          <TextField
            label="Base URL"
            size="small"
            value={settings.baseUrl}
            onChange={(e) => onChange({ ...settings, baseUrl: e.target.value })}
          />
          <TextField
            label="API key"
            size="small"
            type="password"
            value={settings.apiKey}
            onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
          />
          <TextField
            label="Model / LiteLLM model name"
            size="small"
            helperText="Used only when a template's checkpoint is 'auto'. Naming a Laya checkpoint (english / multilingual / typed-decisions) pins it; any other value pins the English router."
            value={settings.model}
            onChange={(e) => onChange({ ...settings, model: e.target.value })}
          />
          <TextField
            label="Endpoint path"
            size="small"
            value={endpoint}
            onChange={(e) => {
              setEndpoint(e.target.value)
              onChange({ ...settings, endpoint: e.target.value })
            }}
          />
          <Divider />

          <Stack spacing={1}>
            <Typography variant="overline">Network path</Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={settings.transport}
              onChange={(_, v) => v && onChange({ ...settings, transport: v as Transport })}
            >
              <ToggleButton value="direct">direct from browser</ToggleButton>
              <ToggleButton value="relay">dev-server relay</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              {settings.transport === 'direct'
                ? 'the browser posts straight to the base URL - no proxy support, because a browser cannot route a single fetch() through one.'
                : `the browser posts to ${RELAY.path} on this dev server, which forwards from node where an HTTP(S) proxy is configurable. Use this when the endpoint is only reachable via a proxy; it also sidesteps CORS.`}
            </Typography>

            {settings.transport === 'relay' && (
              <>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                  <Select
                    size="small"
                    value={settings.proxyMode}
                    onChange={(e) => onChange({ ...settings, proxyMode: e.target.value as ProxyMode })}
                    sx={{ minWidth: 250 }}
                  >
                    <MenuItem value="auto">proxy: from server environment</MenuItem>
                    <MenuItem value="custom">proxy: custom URL</MenuItem>
                    <MenuItem value="none">no proxy (direct from server)</MenuItem>
                  </Select>
                  {settings.proxyMode === 'custom' && (
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="http://user:pass@proxy.internal:3128"
                      value={settings.proxyUrl}
                      onChange={(e) => onChange({ ...settings, proxyUrl: e.target.value })}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {RELAY.proxyFromEnv
                    ? 'the dev server found a proxy in its environment (that value is never sent to the browser)'
                    : 'no proxy in the dev server environment - set HTTPS_PROXY in .env or choose a custom URL'}
                  {settings.proxyMode === 'custom' && !settings.proxyUrl.trim()
                    ? ' | custom URL is empty, so requests will be refused'
                    : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  relay only forwards to: {RELAY.allowedOrigins.join(', ') || '(none - set RELAY_ALLOWED_ORIGINS)'}
                </Typography>
              </>
            )}
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="caption" color="text.secondary">
              confidence gate: {(settings.confidenceGate * 100).toFixed(0)}% — answers below this are
              flagged for human review. Laya's action.act_probability carries no signal (#185); gate on
              confidence.
            </Typography>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.confidenceGate}
              onChange={(e) => onChange({ ...settings, confidenceGate: Number(e.target.value) })}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Loaded from environment: base=<code>{CONFIG.baseUrl}</code> model=<code>{CONFIG.model}</code>
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}
