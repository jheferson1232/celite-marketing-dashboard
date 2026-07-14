/**
 * Utilidades client-safe para identificar URLs gestionadas por nuestro storage
 * (Cloudflare R2). No importar nada server-only aquí.
 */

function getR2PublicBaseUrl(): string | null {
  const raw = (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ??
    process.env.R2_PUBLIC_BASE_URL ??
    ""
  ).trim()
  return raw ? raw.replace(/\/$/, "") : null
}

/** Identifica URLs gestionadas por nuestro storage (Cloudflare R2). */
export function isManagedMediaUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  const trimmed = url.trim()
  const base = getR2PublicBaseUrl()
  if (!base) return false
  return trimmed.startsWith(`${base}/`)
}

/**
 * Extrae el key de un objeto R2 a partir de su URL pública.
 * Devuelve null si la URL no pertenece al bucket configurado.
 */
export function extractR2KeyFromUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  const base = getR2PublicBaseUrl()
  if (!base || !trimmed.startsWith(`${base}/`)) return null
  return trimmed.slice(`${base}/`.length)
}
