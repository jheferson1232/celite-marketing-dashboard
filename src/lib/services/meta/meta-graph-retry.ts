import axios, { type AxiosRequestConfig } from "axios"
import { isMetaRateLimitAxiosError } from "./meta-errors"

const MAX_RETRIES = 4
const BASE_DELAY_MS = 1_500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** GET a Graph API con reintentos ante límite de Meta (códigos 17, 429, etc.). */
export async function metaGraphGet<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get<T>(url, config)
      return data
    } catch (error) {
      lastError = error
      if (!isMetaRateLimitAxiosError(error) || attempt >= MAX_RETRIES) {
        throw error
      }
      await sleep(BASE_DELAY_MS * (attempt + 1))
    }
  }

  throw lastError
}
