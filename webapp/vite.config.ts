import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { createRelayHandler, RELAY_PATH, redact } from './dev/relay'
import { parseAllowlist, proxyDecision, bypassesProxy } from './dev/relayPolicy'

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
const probeTarget = baseUrl || 'https://laya.invalid'

// The relay only ever forwards to the configured LiteLLM origin unless more are
// listed, so the dev server cannot be abused as a general proxy.
const allowedOrigins = parseAllowlist(dotenv.RELAY_ALLOWED_ORIGINS, baseUrl)

// --- network path, decided entirely from the environment ----------------------
// A proxy implies the relay: a browser cannot route fetch() through one. With
// no proxy either path works, so relay stays the default because it also
// removes the CORS question. NET_TRANSPORT overrides for static hosting.
const noProxy = mergedEnv.no_proxy ?? mergedEnv.NO_PROXY
const rawProxyHit = proxyDecision(mergedEnv, probeTarget)
const proxyBypassed = !!rawProxyHit && bypassesProxy(probeTarget, noProxy)
const proxyHit = proxyBypassed ? undefined : rawProxyHit
const envProxy = proxyHit?.url

const explicit = (dotenv.NET_TRANSPORT ?? process.env.NET_TRANSPORT ?? '').trim().toLowerCase()
if (explicit && explicit !== 'direct' && explicit !== 'relay') {
  console.warn(`  net: NET_TRANSPORT="${explicit}" is not "direct" or "relay"; using the automatic choice`)
}
const transport = explicit === 'direct' || explicit === 'relay' ? explicit : 'relay'

let netReason: string
if (explicit) netReason = `NET_TRANSPORT=${explicit}`
else if (envProxy) netReason = `${proxyHit!.source} is set, and a browser cannot proxy a request itself`
else if (proxyBypassed) netReason = `${rawProxyHit!.source} is set but ${hostnameOf(probeTarget)} matches NO_PROXY`
else netReason = 'no proxy in the environment; relay is the default because it also avoids CORS'

if (transport === 'direct' && envProxy) {
  console.warn(`  net: NET_TRANSPORT=direct while ${proxyHit!.source} is set — the browser will ignore that proxy`)
}
console.log(`  net: ${netReason}  ->  ${transport === 'relay' ? `relay ${RELAY_PATH}` : 'direct from browser'}`)
if (envProxy) console.log(`  net: proxy ${redact(envProxy)} (from ${proxyHit!.source})`)

/** scheme + host only, so nothing that leaves the server carries credentials. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function system1Relay(): Plugin {
  // must not return anything: vite treats a function returned from
  // configureServer as a post-init hook and calls it with no request
  const mount = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(createRelayHandler({ allowedOrigins, defaultProxy: envProxy, env: mergedEnv }))
  }
  return {
    name: 'system1-relay',
    configureServer(server) {
      mount(server)
    },
    // the built bundle always knows about the relay, and configureServer is
    // dev-only, so `vite preview` needs the same handler
    configurePreviewServer(server) {
      mount(server)
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
    // the only network value the client needs; the reasoning and the proxy stay
    // in the startup log
    'import.meta.env.NET_TRANSPORT': JSON.stringify(transport),
  },
})
