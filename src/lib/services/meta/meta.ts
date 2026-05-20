import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios"

let metaClient: AxiosInstance | null = null

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2_000

interface MetaRequestConfig extends InternalAxiosRequestConfig {
  __metaRetryCount?: number
}

function isRateLimitError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false

  const metaError = error.response?.data?.error as
    | { code?: number; error_subcode?: number }
    | undefined

  const code = metaError?.code
  return (
    error.response?.status === 429 ||
    code === 17 ||
    code === 613 ||
    code === 80004 ||
    metaError?.error_subcode === 2446079
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function getMetaClient(): AxiosInstance {
  if (!metaClient) {
    const token = process.env.META_ACCESS_TOKEN
    const accountId = process.env.META_AD_ACCOUNT_ID

    if (!token || !accountId) {
      throw new Error("META_ACCESS_TOKEN y META_AD_ACCOUNT_ID son requeridas")
    }

    metaClient = axios.create({
      baseURL: `https://graph.facebook.com/v25.0/act_${accountId}`,
      params: {
        access_token: token,
      },
    })

    metaClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config as MetaRequestConfig | undefined

        if (!config || !isRateLimitError(error)) {
          console.error(
            "Error al hacer la solicitud a Meta:",
            error.response?.data
          )
          return Promise.reject(error)
        }

        const retryCount = config.__metaRetryCount ?? 0
        if (retryCount >= MAX_RETRIES) {
          console.error(
            "Meta API rate limit: reintentos agotados",
            error.response?.data
          )
          return Promise.reject(error)
        }

        config.__metaRetryCount = retryCount + 1
        const delay = RETRY_DELAY_MS * config.__metaRetryCount
        await sleep(delay)

        return metaClient!(config)
      }
    )
  }

  return metaClient
}
