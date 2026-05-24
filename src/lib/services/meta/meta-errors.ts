import axios from "axios"
import { isMetaConfigError } from "./meta-env"

export { isMetaConfigError, MetaEnvNotConfiguredError } from "./meta-env"

type MetaApiErrorBody = {
  code?: number
  error_subcode?: number
  error_user_msg?: string
  message?: string
}

export function isMetaRateLimitStatus(status: number, body: unknown): boolean {
  const metaError = (body as { error?: MetaApiErrorBody } | null)?.error
  const code = metaError?.code

  return (
    status === 429 ||
    code === 17 ||
    code === 613 ||
    code === 80004 ||
    metaError?.error_subcode === 2446079
  )
}

export function metaGraphErrorMessage(status: number, body: unknown): string {
  const metaError = (body as { error?: MetaApiErrorBody } | null)?.error
  const message =
    metaError?.error_user_msg?.trim() ||
    metaError?.message?.trim() ||
    `Meta API respondió con estado ${status}.`
  return message
}

export function isMetaRateLimitAxiosError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  return isMetaRateLimitStatus(
    error.response?.status ?? 0,
    error.response?.data
  )
}

/** Detecta límite Meta en mensajes de server actions / React Query. */
export function isMetaRateLimitMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes("demasiadas llamadas") ||
    normalized.includes("too many calls") ||
    normalized.includes("user request limit") ||
    normalized.includes("rate limit") ||
    normalized.includes("qps limit") ||
    normalized.includes("reaches the qps") ||
    normalized.includes("reduce the amount of data")
  )
}

export function isMetaRateLimitError(error: unknown): boolean {
  if (isMetaRateLimitAxiosError(error)) return true
  if (error instanceof Error && isMetaRateLimitMessage(error.message)) {
    return true
  }
  return false
}

export function getMetaErrorMessage(error: unknown): string {
  if (isMetaConfigError(error) && error instanceof Error) {
    return error.message
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return "Error desconocido al conectar con Meta."
}
