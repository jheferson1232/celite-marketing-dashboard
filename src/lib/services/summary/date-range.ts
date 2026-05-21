import { addDaysToDateString } from "@/lib/date"
import type { DateRange } from "@/lib/services/meta/types"

export function getDaysInRange(from: string, to: string): number {
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1
  return Math.round((end - start) / 86_400_000) + 1
}

/** Mismo número de días inmediatamente antes del rango actual. */
export function getPreviousDateRange(range: DateRange): DateRange {
  const days = getDaysInRange(range.from, range.to)
  const prevTo = addDaysToDateString(range.from, -1)
  const prevFrom = addDaysToDateString(prevTo, -(days - 1))
  return { from: prevFrom, to: prevTo }
}

export function percentChange(
  current: number,
  previous: number
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous <= 0) {
    if (current > 0) return 100
    return null
  }
  const pct = ((current - previous) / previous) * 100
  return Number.isFinite(pct) ? pct : null
}
