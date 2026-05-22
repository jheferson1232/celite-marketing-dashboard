import { buildDateKeys, getDashboardToday } from "@/lib/date"

/** Día en que arranca el historial del informe (solo Meta, sin retroactivo). */
const DEFAULT_META_INFORME_START_DATE = "2026-05-21"

export function getMetaInformeStartDate(): string {
  const fromEnv = process.env.META_INFORME_START_DATE?.trim()
  if (fromEnv && /^\d{4}-\d{2}-\d{2}$/.test(fromEnv)) return fromEnv
  return DEFAULT_META_INFORME_START_DATE
}

/** Desde la fecha de arranque hasta hoy (Lima). Crece día a día. */
export function getMetaInformeDateRange(): { from: string; to: string } {
  const today = getDashboardToday()
  const start = getMetaInformeStartDate()
  return { from: start > today ? today : start, to: today }
}

export function getMetaInformeDateKeys(): string[] {
  const range = getMetaInformeDateRange()
  return buildDateKeys(range.from, range.to)
}
