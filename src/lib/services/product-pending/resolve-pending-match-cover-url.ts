import { isManagedMediaUrl } from "@/lib/services/blob/managed-media-url"
import { isTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"

/** URL usable en <img>: storage propio directo o proxy interno para CDN TikTok. */
export function resolvePendingMatchCoverUrl(
  url: string | null | undefined
): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (isManagedMediaUrl(trimmed)) return trimmed
  if (isTikTokMediaUrl(trimmed)) {
    return `/api/tiktok-thumbnail?url=${encodeURIComponent(trimmed)}`
  }
  return trimmed
}
