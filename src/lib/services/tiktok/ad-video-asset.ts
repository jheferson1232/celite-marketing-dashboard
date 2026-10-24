export const TIKTOK_SPARK_VIDEO_ID_PREFIX = "spark:" as const

export type TikTokAdVideoAsset = {
  id: string
  name: string
  /** @usuario TikTok del post (Spark / orgánico). */
  profileName: string | null
  /** item_id del post orgánico (sin prefijo spark:). */
  itemId: string | null
  /** Texto del post orgánico, cuando TikTok lo devuelve. */
  caption?: string | null
  /** TikTok marcó el video como generado por IA. */
  aiGenerated?: boolean
  /** Identidad Spark Ads asociada al post. */
  identityId: string | null
  identityType: string | null
  /** Business Center que autoriza una identidad BC_AUTH_TT. */
  identityAuthorizedBcId: string | null
  coverUrl: string | null
  previewUrl: string | null
  durationMs: number | null
  width: number | null
  height: number | null
  format: string | null
  createTime: string | null
}

/** Cuenta orgánica de TikTok vinculada para elegir videos en una campaña. */
export type TikTokProfileVideoAccount = {
  username: string
  displayName: string
  linked: boolean
  error: string | null
  videos: TikTokAdVideoAsset[]
}

export function toSparkVideoSelectionId(itemId: string): string {
  return `${TIKTOK_SPARK_VIDEO_ID_PREFIX}${itemId}`
}

export function parseSparkVideoSelectionId(id: string): string | null {
  const trimmed = id.trim()
  if (!trimmed.startsWith(TIKTOK_SPARK_VIDEO_ID_PREFIX)) return null
  const itemId = trimmed.slice(TIKTOK_SPARK_VIDEO_ID_PREFIX.length).trim()
  return itemId || null
}

export function isSparkVideoSelectionId(id: string): boolean {
  return parseSparkVideoSelectionId(id) !== null
}

/** Posts orgánicos Spark (id spark:…) o materiales de biblioteca sin extensión de upload. */
export function isTikTokPostVideoAsset(
  video: Pick<TikTokAdVideoAsset, "id" | "name" | "profileName">
): boolean {
  if (isSparkVideoSelectionId(video.id) || video.profileName) return true
  const name = video.name.trim()
  if (!name) return false
  if (/\.(mp4|mov|avi|m4v|webm|mkv)$/i.test(name)) return false
  return /^\d{10,}$/.test(name)
}

/** Milisegundos de la fecha del video. Sin fecha válida devuelve 0. */
export function tikTokVideoCreateTimeMs(createTime: string | null): number {
  if (!createTime?.trim()) return 0

  const raw = createTime.trim()
  const asUnix = Number(raw)
  if (Number.isFinite(asUnix) && asUnix > 1_000_000_000) {
    return asUnix > 1e12 ? asUnix : asUnix * 1000
  }

  const parsed = Date.parse(raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** Más reciente primero. Sin fecha queda al final. */
export function compareTikTokVideosByDateDesc(
  a: Pick<TikTokAdVideoAsset, "createTime" | "name" | "profileName">,
  b: Pick<TikTokAdVideoAsset, "createTime" | "name" | "profileName">
): number {
  const byTime = tikTokVideoCreateTimeMs(b.createTime) - tikTokVideoCreateTimeMs(a.createTime)
  if (byTime !== 0) return byTime
  return (a.profileName ?? a.name).localeCompare(b.profileName ?? b.name, "es")
}

export function formatTikTokVideoCreateTime(
  createTime: string | null
): string | null {
  if (!createTime?.trim()) return null

  const millis = tikTokVideoCreateTimeMs(createTime)
  if (millis <= 0) return null
  const date = new Date(millis)

  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}
