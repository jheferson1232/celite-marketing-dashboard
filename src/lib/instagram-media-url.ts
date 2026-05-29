const INSTAGRAM_CDN_RE =
  /^https:\/\/([a-z0-9-]+\.)?(cdninstagram\.com|fbcdn\.net|instagram\.com)\//i

/** Evita bloqueo hotlink del CDN de Instagram en el navegador. */
export function proxiedInstagramMediaUrl(
  url: string | null | undefined
): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (!INSTAGRAM_CDN_RE.test(trimmed)) return trimmed
  return `/api/instagram-thumbnail?url=${encodeURIComponent(trimmed)}`
}

export function instagramReelEmbedUrl(shortcode: string): string {
  return `https://www.instagram.com/reel/${encodeURIComponent(shortcode)}/embed`
}
