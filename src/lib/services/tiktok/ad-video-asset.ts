export const TIKTOK_SPARK_VIDEO_ID_PREFIX = "spark:" as const

export type TikTokAdVideoAsset = {
  id: string
  name: string
  /** @usuario TikTok del post (Spark / orgánico). */
  profileName: string | null
  coverUrl: string | null
  previewUrl: string | null
  durationMs: number | null
  width: number | null
  height: number | null
  format: string | null
  createTime: string | null
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

export function formatTikTokVideoCreateTime(
  createTime: string | null
): string | null {
  if (!createTime?.trim()) return null

  const raw = createTime.trim()
  const asUnix = Number(raw)
  const date =
    Number.isFinite(asUnix) && asUnix > 1_000_000_000
      ? new Date(asUnix > 1e12 ? asUnix : asUnix * 1000)
      : new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z")

  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}
