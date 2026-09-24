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

export function proxyFromEnv(env: Record<string, string | undefined>, target: string): string | undefined {
  const specific = proxyVarFor(target)
  for (const key of [specific, ...PROXY_ENV_ORDER]) {
    const v = (env[key] ?? '').trim()
    if (v) return v
  }
  return undefined
}
