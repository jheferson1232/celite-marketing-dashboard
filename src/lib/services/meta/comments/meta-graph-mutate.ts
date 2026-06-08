import {
  isMetaRateLimitMessage,
  isMetaRateLimitStatus,
  metaGraphErrorMessage,
} from "../meta-errors"

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1_500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildUrl(
  path: string,
  params: Record<string, string>,
  token: string
): string {
  const url = new URL(
    path.startsWith("http")
      ? path
      : `https://graph.facebook.com/v25.0/${path.replace(/^\//, "")}`
  )
  url.searchParams.set("access_token", token)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

/** POST a Graph API sin caché (ocultar/responder comentarios). */
export async function metaGraphPostJson<T>(
  path: string,
  params: Record<string, string>,
  token: string
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(buildUrl(path, params, token), {
        method: "POST",
        cache: "no-store",
      })

      const body = await response.json().catch(() => null)

      if (response.ok) {
        return body as T
      }

      if (isMetaRateLimitStatus(response.status, body) && attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * (attempt + 1))
        continue
      }

      throw new Error(metaGraphErrorMessage(response.status, body))
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : ""
      if (isMetaRateLimitMessage(message) && attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * (attempt + 1))
        continue
      }
      throw error
    }
  }

  throw lastError
}
