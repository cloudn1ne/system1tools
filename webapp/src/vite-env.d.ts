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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
