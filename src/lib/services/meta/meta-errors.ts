import axios from "axios"

type MetaApiErrorBody = {
  code?: number
  error_subcode?: number
  error_user_msg?: string
  message?: string
}

export function isMetaRateLimitAxiosError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false

  const metaError = error.response?.data?.error as MetaApiErrorBody | undefined
  const code = metaError?.code

  return (
    error.response?.status === 429 ||
    code === 17 ||
    code === 613 ||
    code === 80004 ||
    metaError?.error_subcode === 2446079
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
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return "Error desconocido al conectar con Meta."
}
