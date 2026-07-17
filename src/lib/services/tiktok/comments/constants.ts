/** Ventana de lectura en /comment/list/ (preguntas tipo precio/ubicación suelen llegar a lo largo de varios días). */
export const TIKTOK_COMMENT_WINDOW_HOURS = 24 * 7

export const TIKTOK_COMMENT_CRON_EXPRESSION = "0 */2 * * *"

export const TIKTOK_COMMENT_TRIGGER_LABEL: Record<string, string> = {
  cron_2h: "🌙 Cron 2h",
  manual: "▶ Manual",
}

/** Perfiles Spark prioritarios para Comentarios IA. */
export const TIKTOK_COMMENT_SPARK_PROFILES = [
  "calzados_urbanos",
  "calzados elite",
] as const

export function matchesTikTokCommentSparkProfile(
  profileName: string | null | undefined
): boolean {
  const normalized = (profileName ?? "").trim().toLowerCase()
  if (!normalized) return false
  return TIKTOK_COMMENT_SPARK_PROFILES.some(
    (profile) =>
      normalized === profile ||
      normalized.replace(/\s+/g, "_") === profile.replace(/\s+/g, "_") ||
      normalized.includes(profile.replace(/\s+/g, "_")) ||
      normalized.includes(profile)
  )
}
