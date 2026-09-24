import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import type { ApiSettings } from '../types'
import { CONFIG, DEFAULT_ENDPOINT, NET, RELAY } from '../config'

/**
 * Endpoint settings. The network path and proxy are reported here but not
 * editable: a browser cannot route one fetch() through a proxy, so that choice
 * belongs to the server environment, not to a session in the UI.
 */
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

          <Stack spacing={0.75}>
            <Typography variant="overline">Network path — set by environment, read only</Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                size="small"
                color={NET.transport === 'relay' ? 'primary' : 'default'}
                label={NET.transport === 'relay' ? `dev-server relay ${RELAY.path}` : 'direct from browser'}
              />
              <Typography variant="caption" color="text.secondary">
                because {NET.reason}
              </Typography>
            </Stack>
            <Box
              sx={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                lineHeight: 1.7,
                color: 'text.secondary',
                whiteSpace: 'pre-wrap',
              }}
            >
              {`transport   ${NET.transport}
proxy       ${NET.proxy ? `${NET.proxy}  (from ${NET.proxySource})` : 'none configured'}
relay hosts ${RELAY.allowedOrigins.join(', ') || '(none - set RELAY_ALLOWED_ORIGINS)'}`}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Change it with HTTPS_PROXY / ALL_PROXY / HTTP_PROXY / NO_PROXY, or force a path with
              NET_TRANSPORT=direct|relay in .env, then restart the server. Nothing here is stored in the
              browser, and a proxy password never reaches it.
            </Typography>
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
