import { isVercelBlobUrl } from "@/lib/services/blob/persist-remote-media"
import { isTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"

/** URL usable en <img>: Blob directo o proxy interno para CDN TikTok. */
export function resolvePendingMatchCoverUrl(
  url: string | null | undefined
): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (isVercelBlobUrl(trimmed)) return trimmed
  if (isTikTokMediaUrl(trimmed)) {
    return `/api/tiktok-thumbnail?url=${encodeURIComponent(trimmed)}`
  }
  return trimmed
}
