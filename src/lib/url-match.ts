export function extractUrlSlug(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  try {
    const u = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    )
    const parts = u.pathname.split("/").filter(Boolean)
    return parts[parts.length - 1] ?? trimmed
  } catch {
    return trimmed.split("/").filter(Boolean).pop() ?? trimmed
  }
}

/** Clave comparable: sin espacios, guiones ni signos. */
export function normalizeMatchKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
}
