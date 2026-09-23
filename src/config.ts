// Runtime config, injected from .env via vite.config define.
const env = import.meta.env as Record<string, string | undefined>

export const CONFIG = {
  apiKey: env.LITELLM_API_KEY ?? '',
  baseUrl: env.LITELLM_BASE_URL ?? '',
  model: env.LITELLM_MODEL ?? '',
}

export const DEFAULT_ENDPOINT = '/v1/systemone'
export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
