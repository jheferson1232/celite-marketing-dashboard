/** Hostnames habituales de CDN de TikTok (covers y video). */
export function isTikTokMediaHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h.includes("tiktok") ||
    h.includes("byteimg") ||
    h.includes("byteoversea") ||
    h.includes("muscdn") ||
    h.includes("ibyteimg")
  )
}

export function isTikTokMediaUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === "https:" && isTikTokMediaHostname(parsed.hostname)
  } catch {
    return false
  }
}
