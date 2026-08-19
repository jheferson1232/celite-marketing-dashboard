/** Zona horaria de la cuenta (Perú). Alinea dashboard y asistente con Meta/TikTok. */
export const DASHBOARD_TIMEZONE = "America/Lima"

export function getDashboardToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_TIMEZONE,
  }).format(new Date())
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return utc.toISOString().slice(0, 10)
}

export function getDashboardYesterday(): string {
  return addDaysToDateString(getDashboardToday(), -1)
}

/** Hora 0–23 en America/Lima. */
export function getDashboardHour(): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: DASHBOARD_TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(new Date())
  return parseInt(hour, 10)
}

export function getTodayDateRange(): { from: string; to: string } {
  const today = getDashboardToday()
  return { from: today, to: today }
}

export function getLastNDaysRange(days: number): { from: string; to: string } {
  const to = getDashboardToday()
  return { from: addDaysToDateString(to, -(days - 1)), to }
}

/** Mes calendario (1–12). Si es el mes actual, `to` no pasa de hoy. */
export function getMonthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  const today = getDashboardToday()
  return { from, to: monthEnd > today ? today : monthEnd }
}

export function buildDateKeys(from: string, to: string): string[] {
  const keys: string[] = []
  let cursor = from
  while (cursor <= to) {
    keys.push(cursor)
    cursor = addDaysToDateString(cursor, 1)
  }
  return keys
}

/** Fecha y hora en español (zona dashboard) para creativos del Baúl. */
export function formatCreativeAddedAt(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: DASHBOARD_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const DATE_ONLY_LOCALE = "es-PE"

/**
 * Interpreta `YYYY-MM-DD` como día de calendario (sin corrimiento por zona).
 * Usa mediodía UTC para formatear con `timeZone: "UTC"`.
 */
export function parseDateOnly(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  return new Date(Date.UTC(y, m - 1, d, 12))
}

function formatDateOnly(
  dateStr: string,
  options: Intl.DateTimeFormatOptions
): string {
  const date = parseDateOnly(dateStr)
  if (!date) return dateStr
  return new Intl.DateTimeFormat(DATE_ONLY_LOCALE, {
    timeZone: "UTC",
    ...options,
  }).format(date)
}

/** ej. 20 jul */
export function formatDashboardDayShort(dateStr: string): string {
  return formatDateOnly(dateStr, { day: "numeric", month: "short" })
}

/** ej. lun 20 jul */
export function formatDashboardDayWithWeekday(dateStr: string): string {
  return formatDateOnly(dateStr, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

/** ej. 20/07/2026 */
export function formatDashboardDayNumeric(dateStr: string): string {
  return formatDateOnly(dateStr, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

/** ej. 27/07 (día/mes en zona Lima, siempre 2 dígitos). */
export function formatDayMonth(value: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DASHBOARD_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
  }).formatToParts(new Date(value))
  const day = parts.find((p) => p.type === "day")?.value ?? "00"
  const month = parts.find((p) => p.type === "month")?.value ?? "00"
  return `${day}/${month}`
}

/** ej. domingo, 20 de julio de 2026 */
export function formatDashboardDayLong(dateStr: string): string {
  return formatDateOnly(dateStr, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Etiqueta de día para UI: "Hoy" / "Ayer" / "lun 18 jul".
 * Preferir relativo cuando aplica; absoluto corto en el resto.
 */
export function formatDashboardDayLabel(
  dateStr: string,
  today: string,
  yesterday: string
): string {
  if (dateStr === today) return "Hoy"
  if (dateStr === yesterday) return "Ayer"
  return formatDashboardDayWithWeekday(dateStr)
}
