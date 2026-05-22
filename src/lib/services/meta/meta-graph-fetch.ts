import {
  isMetaRateLimitMessage,
  isMetaRateLimitStatus,
  metaGraphErrorMessage,
} from "./meta-errors"

export const META_DATA_CACHE_TAG = "meta-data"
export const META_REVALIDATE_SECONDS = 1800

const MAX_RETRIES = 4
const BASE_DELAY_MS = 1_500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function buildMetaGraphUrl(
  path: string,
  params: Record<string, string>
): string {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    throw new Error("META_ACCESS_TOKEN es requerida")
  }

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

const metaFetchCacheNext = {
  revalidate: META_REVALIDATE_SECONDS,
  tags: [META_DATA_CACHE_TAG],
}

/** GET a Graph API con caché Next.js (30 min) y reintentos ante rate limit. */
export async function metaGraphFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        method: init?.method ?? "GET",
        next: metaFetchCacheNext,
      })

      if (response.ok) {
        return response
      }

      const body = await response.json().catch(() => null)
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

export async function metaGraphFetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await metaGraphFetch(url, init)
  return response.json() as Promise<T>
}
