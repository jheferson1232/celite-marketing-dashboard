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

/** `bape-sta` → `Bape Sta` */
export function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

export interface LandingPageUrlParts {
  slug: string
  modelKey: string
  modelLabel: string
  variantKey: string
  variantLabel: string
}

/**
 * Parte slugs tipo `modelo--color` (ej. `bape-sta--gris-blanco`).
 * Sin `--`, el slug completo es el modelo y la variante queda genérica.
 */
export function parseLandingPageParts(url: string): LandingPageUrlParts {
  const slug = decodeURIComponent(extractUrlSlug(url))
  const sep = "--"
  const idx = slug.indexOf(sep)

  if (!slug || idx === -1) {
    const label = slugToLabel(slug) || url.trim() || "Landing"
    return {
      slug,
      modelKey: slug || url.trim().toLowerCase(),
      modelLabel: label,
      variantKey: "",
      variantLabel: slug ? "Principal" : "Link",
    }
  }

  const modelKey = slug.slice(0, idx)
  const variantKey = slug.slice(idx + sep.length)

  return {
    slug,
    modelKey,
    modelLabel: slugToLabel(modelKey) || modelKey,
    variantKey,
    variantLabel: slugToLabel(variantKey) || variantKey || "Principal",
  }
}
