/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly LITELLM_API_KEY?: string
  readonly LITELLM_BASE_URL?: string
  readonly LITELLM_MODEL?: string
  /** same-origin path of the dev-server relay, e.g. "/__relay" */
  readonly RELAY_PATH?: string
  /** comma-separated origins the relay will forward to */
  readonly RELAY_ALLOWED_ORIGINS?: string
  /** "1" when the dev server picked a proxy out of its own environment */
  readonly RELAY_PROXY_FROM_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
