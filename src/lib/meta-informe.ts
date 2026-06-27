import {
  addDaysToDateString,
  buildDateKeys,
  getDashboardToday,
} from "@/lib/date"

/** Primer día del informe operativo (America/Lima). */
export const META_INFORME_MIN_START_DATE = "2026-05-21"

/** Ventana por defecto en tabla/sync (días inclusive, Lima). */
export const META_INFORME_DEFAULT_MAX_DAYS = 7

export function getMetaInformeMaxHistoryDays(): number {
  const raw = process.env.META_INFORME_MAX_DAYS?.trim()
  if (!raw) return META_INFORME_DEFAULT_MAX_DAYS
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return META_INFORME_DEFAULT_MAX_DAYS
  }
  return parsed
}

/**
 * Historial del informe (America/Lima).
 * Acotado a los últimos `META_INFORME_MAX_DAYS` (default 7).
 * `META_INFORME_START_DATE` puede fijar un inicio más reciente (no antes del mínimo).
 */
export function getMetaInformeStartDate(): string {
  const today = getDashboardToday()
  const fromEnv = process.env.META_INFORME_START_DATE?.trim()
  const maxDays = getMetaInformeMaxHistoryDays()
  const rollingStart = addDaysToDateString(today, -(maxDays - 1))

  let start = META_INFORME_MIN_START_DATE
  if (fromEnv && /^\d{4}-\d{2}-\d{2}$/.test(fromEnv)) {
    start = fromEnv
  }
  if (start < META_INFORME_MIN_START_DATE) {
    start = META_INFORME_MIN_START_DATE
  }
  if (start > today) {
    start = today
  }
  if (start < rollingStart) {
    start = rollingStart
  }

  return start
}

/** Desde inicio del informe hasta hoy. */
export function getMetaInformeDateRange(): { from: string; to: string } {
  const today = getDashboardToday()
  const start = getMetaInformeStartDate()
  return { from: start > today ? today : start, to: today }
}

/** Más reciente primero (hoy a la izquierda): 23, 22, 21… */
export function getMetaInformeDateKeys(): string[] {
  const range = getMetaInformeDateRange()
  return buildDateKeys(range.from, range.to).toReversed()
}
