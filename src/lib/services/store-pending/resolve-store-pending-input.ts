import { ServerActionError } from "@/lib/server-action"
import { normalizeStoreDomain } from "@/lib/services/sociavault/meta-ad-library-parse"

export type ResolvedStorePendingInput = {
  name: string
  domain: string | null
  pageUrl: string | null
  metaPageId: string | null
}

function isFacebookHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "")
  return host === "facebook.com" || host === "fb.com" || host.endsWith(".facebook.com")
}

function humanizeSlug(value: string): string {
  const cleaned = value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!cleaned) return value
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function nameFromDomain(domain: string): string {
  const base = domain.split(".")[0] ?? domain
  return humanizeSlug(base)
}

function normalizeFacebookPageUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
    if (!isFacebookHost(url.hostname)) return null
    url.hash = ""
    return url
  } catch {
    return null
  }
}

function extractFacebookPageId(url: URL): string | null {
  const id = url.searchParams.get("id")?.trim()
  return id || null
}

function extractFacebookPageSlug(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean)
  if (segments.length === 0) return null

  const first = segments[0]?.toLowerCase()
  if (
    first === "profile.php" ||
    first === "people" ||
    first === "pages" ||
    first === "pg"
  ) {
    if (segments[1] && segments[1] !== "profile.php") {
      return segments[1]
    }
    return null
  }

  if (first === "ads" || first === "watch" || first === "groups") return null
  return segments[0] ?? null
}

export function resolveStorePendingInput(
  source: string
): ResolvedStorePendingInput {
  const trimmed = source.trim()
  if (!trimmed) {
    throw new ServerActionError(
      "Indica la URL de la página de Facebook o el dominio de la tienda."
    )
  }

  const facebookUrl = normalizeFacebookPageUrl(trimmed)
  if (facebookUrl) {
    const metaPageId = extractFacebookPageId(facebookUrl)
    const slug = extractFacebookPageSlug(facebookUrl)
    const name = slug ? humanizeSlug(slug) : metaPageId ? `Página ${metaPageId}` : "Página Facebook"

    return {
      name,
      domain: null,
      pageUrl: facebookUrl.toString(),
      metaPageId,
    }
  }

  const domain = normalizeStoreDomain(trimmed)
  if (!domain) {
    throw new ServerActionError(
      "No se reconoció una URL de Facebook ni un dominio válido."
    )
  }

  const pageUrl = trimmed.includes("://") ? trimmed : `https://${domain}`

  return {
    name: nameFromDomain(domain),
    domain,
    pageUrl,
    metaPageId: null,
  }
}
