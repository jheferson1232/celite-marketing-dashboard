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
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false
    return isTikTokMediaHostname(parsed.hostname)
  } catch {
    return false
  }
}

/** Normaliza covers/videos de TikTok a https (el CDN suele firmar ambos). */
export function normalizeTikTokMediaUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.startsWith("http://")) {
    return `https://${trimmed.slice("http://".length)}`
  }
  return trimmed
}
