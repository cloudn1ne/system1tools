import type { IncomingMessage, ServerResponse } from 'node:http'
import http from 'node:http'
import https from 'node:https'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import { isAllowedTarget, proxyDecision, bypassesProxy } from './relayPolicy'

export const RELAY_PATH = '/__relay'

export interface RelayConfig {
  /** only these origins may be used as relay targets */
  allowedOrigins: string[]
  /** fallback proxy when the client does not send X-Relay-Proxy */
  defaultProxy?: string
  env?: Record<string, string | undefined>
  maxBodyBytes?: number
  timeoutMs?: number
}

/** Strip credentials so a proxy URL can appear in a message or log safely. */
export function redact(proxy: string): string {
  try {
    const u = new URL(proxy)
    if (u.username || u.password) {
      u.username = '***'
      u.password = '***'
    }
    return u.toString()
  } catch {
    return '(unparseable proxy URL)'
  }
}

function reply(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer | string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > limit) {
        reject(new Error(`request body exceeds ${limit} bytes`))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function header(req: IncomingMessage, name: string): string {
  const v = req.headers[name.toLowerCase()]
  if (Array.isArray(v)) return v[0] ?? ''
  return typeof v === 'string' ? v : ''
}

/**
 * Same-origin relay so the browser never needs proxy support (it cannot have
 * any): the browser posts to RELAY_PATH, this forwards to the allow-listed
 * target from node, where an HTTP(S) proxy is actually configurable.
 */
export function createRelayHandler(cfg: RelayConfig) {
  const limit = cfg.maxBodyBytes ?? 4 * 1024 * 1024
  const timeoutMs = cfg.timeoutMs ?? 60_000
  const env = cfg.env ?? process.env

  return function relay(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    if (!req.url || !req.url.startsWith(RELAY_PATH)) {
      next()
      return
    }
    if (req.method !== 'POST') {
      reply(res, 405, { detail: `${RELAY_PATH} only accepts POST` })
      return
    }

    const target = header(req, 'x-relay-target')
    if (!target) {
      reply(res, 400, { detail: 'missing X-Relay-Target header' })
      return
    }
    if (!isAllowedTarget(target, cfg.allowedOrigins)) {
      reply(res, 403, {
        detail:
          `relay target ${target} is not allowed. Add its origin to RELAY_ALLOWED_ORIGINS in .env ` +
          `(the relay is pinned to the configured LiteLLM origin so the dev server cannot be ` +
          `abused as a general proxy).`,
      })
      return
    }

    void (async () => {
      let payload: Buffer | string
      try {
        payload = await readBody(req, limit)
      } catch (e) {
        reply(res, 413, { detail: e instanceof Error ? e.message : String(e) })
        return
      }

      // Proxy choice. Normally the client sends no proxy header at all and this
      // is decided purely from the server environment:
      //   absent  -> environment proxy (HTTPS_PROXY / ALL_PROXY / HTTP_PROXY),
      //              unless NO_PROXY covers the target
      //   empty   -> force a direct connection from this server
      //   a value -> that proxy, verbatim (an explicit override ignores NO_PROXY)
      const sent = req.headers['x-relay-proxy']
      const noProxy = env.no_proxy ?? env.NO_PROXY
      let proxy: string | undefined
      let proxySource = ''
      if (typeof sent === 'string') {
        proxy = sent.trim() || undefined
        proxySource = proxy ? 'X-Relay-Proxy' : ''
      } else if (!bypassesProxy(target, noProxy)) {
        const d = proxyDecision(env, target) ?? (cfg.defaultProxy ? { url: cfg.defaultProxy, source: 'relay config' } : undefined)
        if (d) {
          proxy = d.url
          proxySource = d.source
        }
      } else if (proxyDecision(env, target)) {
        proxySource = `skipped, ${target} matches NO_PROXY`
      }

      let agent: HttpsProxyAgent<string> | HttpProxyAgent<string> | undefined
      if (proxy) {
        try {
          agent = target.startsWith('https:') ? new HttpsProxyAgent(proxy) : new HttpProxyAgent(proxy)
        } catch (e) {
          reply(res, 400, { detail: `invalid proxy URL "${proxy}": ${e instanceof Error ? e.message : String(e)}` })
          return
        }
      }

      const url = new URL(target)
      const transport = url.protocol === 'https:' ? https : http
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(payload)),
        Host: url.host,
      }
      const auth = header(req, 'authorization')
      if (auth) headers.Authorization = auth

      const upstream = transport.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          headers,
          agent: agent ?? undefined,
        },
        (up) => {
          res.statusCode = up.statusCode ?? 502
          const ct = up.headers['content-type']
          if (ct) res.setHeader('Content-Type', ct)
          up.pipe(res)
        },
      )

      upstream.setTimeout(timeoutMs, () => {
        upstream.destroy(new Error(`upstream timed out after ${timeoutMs} ms`))
      })
      upstream.on('error', (e: Error) => {
        if (res.headersSent) {
          res.end()
          return
        }
        const via = proxy ? ` via proxy ${redact(proxy)} (${proxySource})` : proxySource ? ` (${proxySource})` : ' directly'
        reply(res, 502, { detail: `relay to ${target} failed${via}: ${e.message}` })
      })
      upstream.end(payload)
    })()
  }
}
