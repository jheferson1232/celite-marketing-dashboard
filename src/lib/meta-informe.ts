import {
  buildDateKeys,
  getDashboardToday,
  getDashboardYesterday,
} from "@/lib/date"

/**
 * Historial del informe (America/Lima).
 * Sin env: desde ayer. Con META_INFORME_START_DATE: desde esa fecha (puede ser anterior a ayer).
 */
export function getMetaInformeStartDate(): string {
  const yesterday = getDashboardYesterday()
  const today = getDashboardToday()
  const fromEnv = process.env.META_INFORME_START_DATE?.trim()

  if (fromEnv && /^\d{4}-\d{2}-\d{2}$/.test(fromEnv)) {
    return fromEnv > today ? today : fromEnv
  }

  return yesterday
}

/** Desde ayer (o env) hasta hoy. */
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
