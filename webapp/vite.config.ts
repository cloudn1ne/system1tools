import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import type { Plugin } from 'vite'
import { createRelayHandler, RELAY_PATH } from './dev/relay'
import { parseAllowlist, proxyFromEnv } from './dev/relayPolicy'

/**
 * Authoritative env values come from ./webapp/.env (the user-requested LiteLLM
 * endpoint). We parse that file directly so the process environment's
 * LITELLM_* vars (which differ here) never override it.
 */
function loadDotEnv(path = '.env'): Record<string, string> {
  const out: Record<string, string> = {}
  let txt: string | null = null
  try {
    txt = fs.readFileSync(path, 'utf8')
  } catch {
    return out
  }
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
    out[key] = val
  }
  return out
}

const dotenv = loadDotEnv('.env')
/** .env wins over the inherited shell environment. */
const mergedEnv: Record<string, string | undefined> = { ...process.env, ...dotenv }
const baseUrl = dotenv.LITELLM_BASE_URL || ''

// The relay only ever forwards to the configured LiteLLM origin unless more are
// listed. Never expose the resolved proxy URL to the browser: it can carry
// credentials, and the proxy is only ever used server-side.
const allowedOrigins = parseAllowlist(dotenv.RELAY_ALLOWED_ORIGINS, baseUrl)
const envProxy = proxyFromEnv(mergedEnv, baseUrl || 'https://example.invalid')
const proxyPresentFromEnv = envProxy ? '1' : ''
if (envProxy) console.log(`  relay: proxy taken from environment (${redact(envProxy)})`)

/** http://user:pass@host -> http://***:***@host, so logs never leak secrets. */
function redact(proxy: string): string {
  try {
    const u = new URL(proxy)
    if (u.username || u.password) {
      u.username = '***'
      u.password = '***'
    }
    return u.toString()
  } catch {
    return '(unparseable)'
  }
}

function system1Relay(): Plugin {
  return {
    name: 'system1-relay',
    configureServer(server) {
      server.middlewares.use(
        createRelayHandler({ allowedOrigins, defaultProxy: envProxy, env: mergedEnv }),
      )
    },
    // the bundle always ships knowing about the relay, so `vite preview` (and
    // any served build) needs it too - configureServer alone is dev-only
    configurePreviewServer(server) {
      server.middlewares.use(
        createRelayHandler({ allowedOrigins, defaultProxy: envProxy, env: mergedEnv }),
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), system1Relay()],
  server: {
    port: 8019,
    host: true,
    open: false,
    allowedHosts: ['pi1.warp.at', 'pi.warp.at', 'localhost'],
  },
  define: {
    'import.meta.env.LITELLM_API_KEY': JSON.stringify(dotenv.LITELLM_API_KEY ?? ''),
    'import.meta.env.LITELLM_BASE_URL': JSON.stringify(dotenv.LITELLM_BASE_URL ?? ''),
    'import.meta.env.LITELLM_MODEL': JSON.stringify(dotenv.LITELLM_MODEL ?? ''),
    'import.meta.env.RELAY_PATH': JSON.stringify(RELAY_PATH),
    'import.meta.env.RELAY_ALLOWED_ORIGINS': JSON.stringify(allowedOrigins.join(',')),
    'import.meta.env.RELAY_PROXY_FROM_ENV': JSON.stringify(proxyPresentFromEnv),
  },
})
