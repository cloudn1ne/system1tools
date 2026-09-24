import type { Transport } from './types'

// Runtime config, injected from .env via vite.config define.
// `import.meta.env` only exists under vite; the ?? fallback keeps this module
// importable from plain node (tests import api.ts, which imports this).
const env = (import.meta.env ?? {}) as ImportMetaEnv

export const CONFIG = {
  apiKey: env.LITELLM_API_KEY ?? '',
  baseUrl: env.LITELLM_BASE_URL ?? '',
  model: env.LITELLM_MODEL ?? '',
}

export const DEFAULT_ENDPOINT = '/v1/systemone'
export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Relay plumbing, decided by the server (see dev/relay.ts). */
export const RELAY = {
  path: env.RELAY_PATH ?? '/__relay',
  allowedOrigins: (env.RELAY_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
}

/**
 * How requests reach the endpoint. Decided from the environment at server start
 * (HTTPS_PROXY / ALL_PROXY / HTTP_PROXY / NO_PROXY / NET_TRANSPORT) and shown to
 * the user read-only — a browser cannot route a single fetch() through a proxy,
 * so when one is configured the request must go via the relay.
 */
export const NET = {
  transport: (env.NET_TRANSPORT === 'direct' ? 'direct' : 'relay') as Transport,
  /** why this path was chosen, e.g. "HTTPS_PROXY is set, ..." */
  reason: env.NET_REASON ?? 'default',
  /** proxy as `scheme://host:port` — never contains credentials */
  proxy: env.NET_PROXY ?? '',
  /** which variable the proxy came from, e.g. "HTTPS_PROXY" */
  proxySource: env.NET_PROXY_SOURCE ?? '',
}

export type { Transport, ProxyMode } from './types'
