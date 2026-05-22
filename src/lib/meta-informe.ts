import {
  buildDateKeys,
  getDashboardToday,
  getDashboardYesterday,
} from "@/lib/date"

/** No notificar olvidos si el acumulado de puntos es ≤ este valor. */
export const INFORME_NOTIFY_POINTS_CUTOFF = -3

/**
 * Historial desde ayer (Lima) hacia adelante.
 * META_INFORME_START_DATE solo puede retrasar el arranque, nunca ir antes de ayer.
 */
export function getMetaInformeStartDate(): string {
  const yesterday = getDashboardYesterday()
  const today = getDashboardToday()
  const fromEnv = process.env.META_INFORME_START_DATE?.trim()

  if (fromEnv && /^\d{4}-\d{2}-\d{2}$/.test(fromEnv)) {
    const effective = fromEnv < yesterday ? yesterday : fromEnv
    return effective > today ? today : effective
  }

  return yesterday
}

/** Desde ayer (o env) hasta hoy. */
export function getMetaInformeDateRange(): { from: string; to: string } {
  const today = getDashboardToday()
  const start = getMetaInformeStartDate()
  return { from: start > today ? today : start, to: today }
}

export function getMetaInformeDateKeys(): string[] {
  const range = getMetaInformeDateRange()
  return buildDateKeys(range.from, range.to)
}
