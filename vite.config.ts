import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

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

export default defineConfig({
  plugins: [react()],
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
  },
})
