import { buildDateKeys, getDashboardToday } from "@/lib/date"

/** Primer día del informe operativo (America/Lima). */
export const META_INFORME_MIN_START_DATE = "2026-05-21"

/**
 * Historial del informe (America/Lima).
 * Por defecto desde 2026-05-21. `META_INFORME_START_DATE` puede fijar o ampliar el inicio (no antes del mínimo).
 */
export function getMetaInformeStartDate(): string {
  const today = getDashboardToday()
  const fromEnv = process.env.META_INFORME_START_DATE?.trim()

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
