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
