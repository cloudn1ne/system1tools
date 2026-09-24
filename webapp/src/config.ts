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

/** Relay plumbing, decided by the dev server (see dev/relay.ts). */
export const RELAY = {
  path: env.RELAY_PATH ?? '/__relay',
  allowedOrigins: (env.RELAY_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  /** the dev server already has a proxy in its environment */
  proxyFromEnv: env.RELAY_PROXY_FROM_ENV === '1',
}

/**
 * A browser cannot route a single fetch() through a proxy, so 'relay' sends the
 * request to the dev server, which forwards it from node where a proxy is
 * configurable. 'direct' talks to the endpoint straight from the browser.
 */
export type { Transport, ProxyMode } from './types'
