/**
 * Pure policy helpers for the dev-server relay. No node/browser APIs, so this
 * is unit-testable and shared by the relay and the UI.
 */

/** `https://host:port/path` -> `https://host:port` (or null when unparseable). */
export function originOf(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin
  } catch {
    return null
  }
}

/** Comma/space separated allowlist -> normalized origins, dropping junk. */
export function parseAllowlist(csv: string | undefined, base?: string): string[] {
  const out = new Set<string>()
  for (const part of `${csv ?? ''},${base ?? ''}`.split(/[,\s]+/)) {
    if (!part.trim()) continue
    const o = originOf(part.includes('://') ? part : `https://${part}`)
    if (o) out.add(o)
  }
  return [...out]
}

/**
 * The relay is an open forwarder unless targets are pinned, so the target
 * origin must appear in the allowlist. This is what stops the dev server being
 * used as a proxy to arbitrary internal hosts.
 */
export function isAllowedTarget(target: string, allowedOrigins: string[]): boolean {
  const o = originOf(target)
  return o !== null && allowedOrigins.includes(o)
}

/** An explicit UI value wins over the environment default; empty means none. */
export function resolveProxy(explicit: string | undefined, fallback: string | undefined): string | undefined {
  const e = (explicit ?? '').trim()
  if (e) return e
  const f = (fallback ?? '').trim()
  return f || undefined
}

/** Which environment variable would a request to this target honour? */
export function proxyVarFor(target: string): 'https_proxy' | 'http_proxy' {
  return originOf(target)?.startsWith('https:') ? 'https_proxy' : 'http_proxy'
}

/** Common env spellings, most specific first. */
export const PROXY_ENV_ORDER = ['https_proxy', 'HTTPS_PROXY', 'all_proxy', 'ALL_PROXY', 'http_proxy', 'HTTP_PROXY'] as const

export interface ProxyDecision {
  url: string
  /** which variable it came from, for the read-only settings display */
  source: string
}

export function proxyDecision(env: Record<string, string | undefined>, target: string): ProxyDecision | undefined {
  const specific = proxyVarFor(target)
  for (const key of [specific, ...PROXY_ENV_ORDER]) {
    const v = (env[key] ?? '').trim()
    if (v) return { url: v, source: key }
  }
  return undefined
}

export function proxyFromEnv(env: Record<string, string | undefined>, target: string): string | undefined {
  return proxyDecision(env, target)?.url
}

/**
 * NO_PROXY / no_proxy support. An explicit proxy agent bypasses the platform
 * defaults entirely, so without this a NO_PROXY list silently does nothing.
 * Accepts `*`, `*.domain`, `.domain` and bare hostnames (all treated as suffix
 * matches), an optional :port, comma or space separated.
 */
export function bypassesProxy(target: string, noProxy: string | undefined): boolean {
  const o = originOf(target)
  if (!o) return false
  const host = new URL(o).hostname.toLowerCase()
  const port = new URL(o).port || (o.startsWith('https:') ? '443' : '80')
  for (const raw of `${noProxy ?? ''}`.split(/[,\s]+/)) {
    let entry = raw.trim().toLowerCase()
    if (!entry) continue
    if (entry === '*') return true
    let entryPort = ''
    const m = entry.match(/^(.*):(\d+)$/)
    if (m) {
      entry = m[1]
      entryPort = m[2]
    }
    if (entryPort && entryPort !== port) continue
    // '*.warp.at', '.warp.at' and 'warp.at' all mean the same suffix
    entry = entry.replace(/^\*\.?/, '').replace(/^\.+/, '').replace(/\.+$/, '')
    if (!entry) continue
    if (host === entry || host.endsWith(`.${entry}`)) return true
  }
  return false
}
