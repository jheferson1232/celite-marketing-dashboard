import {
  getMetaErrorMessage,
  isMetaRateLimitError,
} from "@/lib/services/meta/meta-errors"

export type MetaApiStatus =
  | "loading"
  | "ok"
  | "rate_limit"
  | "error"
  | "idle"

interface QuerySlice {
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  isSuccess: boolean
  error: Error | null
}

interface GetMetaApiStatusInput {
  isReloading?: boolean
  campaigns: QuerySlice
  kpis: QuerySlice
}

export interface MetaApiStatusResult {
  status: MetaApiStatus
  label: string
  description: string
}

export function getMetaApiStatus({
  isReloading = false,
  campaigns,
  kpis,
}: GetMetaApiStatusInput): MetaApiStatusResult {
  const primaryError = campaigns.error ?? kpis.error

  if (primaryError) {
    const message = getMetaErrorMessage(primaryError)
    if (isMetaRateLimitError(primaryError)) {
      return {
        status: "rate_limit",
        label: "Límite Meta",
        description: message,
      }
    }
    return {
      status: "error",
      label: "Error Meta",
      description: message,
    }
  }

  const isLoading =
    isReloading ||
    (campaigns.isLoading && !campaigns.isSuccess) ||
    (kpis.isLoading && !kpis.isSuccess)

  if (isLoading) {
    return {
      status: "loading",
      label: "Conectando…",
      description: "Consultando la API de Meta.",
    }
  }

  if (campaigns.isFetching || kpis.isFetching) {
    return {
      status: "loading",
      label: "Actualizando…",
      description: "Sincronizando datos con Meta.",
    }
  }

  if (campaigns.isSuccess) {
    return {
      status: "ok",
      label: "Meta OK",
      description: "Conexión con Meta operativa.",
    }
  }

  if (kpis.isSuccess) {
    return {
      status: "ok",
      label: "Meta OK",
      description: "KPIs cargados. Las campañas pueden estar pendientes.",
    }
  }

  return {
    status: "idle",
    label: "Meta",
    description: "Sin datos de Meta todavía.",
  }
}
