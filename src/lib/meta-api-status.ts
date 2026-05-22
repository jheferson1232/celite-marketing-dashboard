import {
  getMetaErrorMessage,
  isMetaConfigError,
  isMetaRateLimitError,
  isMetaRateLimitMessage,
} from "@/lib/services/meta/meta-errors"

export type MetaApiStatus =
  | "loading"
  | "ok"
  | "rate_limit"
  | "config"
  | "error"
  | "idle"

export interface MetaQuerySlice {
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  isSuccess: boolean
  error: Error | null
}

interface GetMetaApiStatusInput {
  isReloading?: boolean
  campaigns: MetaQuerySlice
  kpis: MetaQuerySlice
}

export interface MetaApiStatusResult {
  status: MetaApiStatus
  label: string
  description: string
}

function statusFromError(error: Error): MetaApiStatusResult {
  const message = getMetaErrorMessage(error)
  if (isMetaConfigError(error)) {
    return {
      status: "config",
      label: "Config Meta",
      description: message,
    }
  }
  if (isMetaRateLimitError(error)) {
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

/** Estado Meta a partir de una sola consulta (p. ej. informe IA). */
export function getMetaApiStatusFromQuery(
  query: MetaQuerySlice,
  options?: { isReloading?: boolean }
): MetaApiStatusResult {
  const { isReloading = false } = options ?? {}

  if (query.error) {
    return statusFromError(query.error)
  }

  const isLoading =
    isReloading || (query.isLoading && !query.isSuccess)

  if (isLoading) {
    return {
      status: "loading",
      label: "Conectando…",
      description: "Consultando la API de Meta.",
    }
  }

  if (query.isFetching) {
    return {
      status: "loading",
      label: "Actualizando…",
      description: "Sincronizando datos con Meta.",
    }
  }

  if (query.isSuccess) {
    return {
      status: "ok",
      label: "Meta OK",
      description: "Conexión con Meta operativa.",
    }
  }

  return {
    status: "idle",
    label: "Meta",
    description: "Sin datos de Meta todavía.",
  }
}

export function getMetaApiStatus({
  isReloading = false,
  campaigns,
  kpis,
}: GetMetaApiStatusInput): MetaApiStatusResult {
  const primaryError = campaigns.error ?? kpis.error

  if (primaryError) {
    return statusFromError(primaryError)
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

/** Combina carga del informe, sync manual y errores Meta en acciones horarias. */
export function getMetaInformeApiStatus(input: {
  informe: MetaQuerySlice
  isSyncing?: boolean
  hourlyError?: string | null
}): MetaApiStatusResult {
  const hourlyMetaError =
    input.hourlyError &&
    (isMetaRateLimitMessage(input.hourlyError) ||
      /\bmeta\b/i.test(input.hourlyError))
      ? new Error(input.hourlyError)
      : null

  const error = input.informe.error ?? hourlyMetaError

  return getMetaApiStatusFromQuery(
    {
      isLoading: input.informe.isLoading,
      isFetching: input.informe.isFetching || Boolean(input.isSyncing),
      isError: input.informe.isError || Boolean(error),
      isSuccess: input.informe.isSuccess && !error,
      error,
    },
    { isReloading: input.isSyncing }
  )
}
