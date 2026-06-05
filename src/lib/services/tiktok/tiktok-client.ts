import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios"

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2_000

export type TikTokCredentialSource = "database" | "env"

export type TikTokCredentials = {
  accessToken: string
  advertiserId: string
  identityId: string | null
  source: TikTokCredentialSource
  accountId: string | null
}

interface TikTokRequestConfig extends InternalAxiosRequestConfig {
  __tiktokRetryCount?: number
}

function isRateLimitError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false

  const status = error.response?.status
  const code = (error.response?.data as { code?: number } | undefined)?.code

  return status === 429 || code === 40100 || code === 40101
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function readTikTokEnvCredentials(): TikTokCredentials | null {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN?.trim()
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID?.trim()
  if (!accessToken || !advertiserId) return null

  return {
    accessToken,
    advertiserId,
    identityId: process.env.TIKTOK_IDENTITY_ID?.trim() || null,
    source: "env",
    accountId: null,
  }
}

export function createTikTokClient(accessToken: string): AxiosInstance {
  const client = axios.create({
    baseURL: "https://business-api.tiktok.com/open_api/v1.3",
    headers: {
      "Access-Token": accessToken,
    },
  })

  client.interceptors.response.use(
    (response) => {
      const data = response.data as { code?: number; message?: string }
      if (data?.code !== undefined && data.code !== 0) {
        const err = new Error(data.message || `TikTok API error ${data.code}`)
        return Promise.reject(err)
      }
      return response
    },
    async (error) => {
      const config = error.config as TikTokRequestConfig | undefined

      if (!config || !isRateLimitError(error)) {
        console.error(
          "Error al hacer la solicitud a TikTok:",
          error.response?.data ?? error.message
        )
        return Promise.reject(error)
      }

      const retryCount = config.__tiktokRetryCount ?? 0
      if (retryCount >= MAX_RETRIES) {
        return Promise.reject(error)
      }

      config.__tiktokRetryCount = retryCount + 1
      await sleep(RETRY_DELAY_MS * config.__tiktokRetryCount)
      return client(config)
    }
  )

  return client
}

/** @deprecated Usar getTikTokRequestContext() en tiktok-api.server.ts */
export function getTikTokClient(): AxiosInstance {
  const fromEnv = readTikTokEnvCredentials()
  if (!fromEnv) {
    throw new Error(
      "TIKTOK_ACCESS_TOKEN y TIKTOK_ADVERTISER_ID son requeridas"
    )
  }
  return createTikTokClient(fromEnv.accessToken)
}

/** @deprecated Usar getTikTokRequestContext() en tiktok-api.server.ts */
export function getTikTokAdvertiserId(): string {
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID?.trim()
  if (!advertiserId) {
    throw new Error("TIKTOK_ADVERTISER_ID es requerida")
  }
  return advertiserId
}
