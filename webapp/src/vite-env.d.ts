/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly LITELLM_API_KEY?: string
  readonly LITELLM_BASE_URL?: string
  readonly LITELLM_MODEL?: string
  /** same-origin path of the server relay, e.g. "/__relay" */
  readonly RELAY_PATH?: string
  /** comma-separated origins the relay will forward to */
  readonly RELAY_ALLOWED_ORIGINS?: string
  /** "direct" | "relay", decided from the environment at server start */
  readonly NET_TRANSPORT?: string
  /** human-readable reason for that choice */
  readonly NET_REASON?: string
  /** configured proxy as scheme://host:port, credentials never included */
  readonly NET_PROXY?: string
  /** variable the proxy came from, e.g. "HTTPS_PROXY" */
  readonly NET_PROXY_SOURCE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
