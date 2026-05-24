const META_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["'][^>]*>/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
  /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/i,
]

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function extractMetaImageUrl(html: string): string | null {
  for (const pattern of META_IMAGE_PATTERNS) {
    const match = html.match(pattern)
    const raw = match?.[1]?.trim()
    if (raw) return decodeHtmlEntities(raw)
  }
  return null
}

function resolveAbsoluteUrl(rawUrl: string, pageUrl: string): string | null {
  try {
    return new URL(rawUrl, pageUrl).href
  } catch {
    return null
  }
}

function extractFirstContentImage(html: string, pageUrl: string): string | null {
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)]

  for (const match of matches) {
    const raw = decodeHtmlEntities(match[1].trim())
    if (!raw || raw.startsWith("data:")) continue

    const lower = raw.toLowerCase()
    if (
      lower.includes("pixel") ||
      lower.includes("tracking") ||
      lower.endsWith(".svg")
    ) {
      continue
    }

    const absolute = resolveAbsoluteUrl(raw, pageUrl)
    if (absolute) return absolute
  }

  return null
}

export async function fetchLandingPagePreviewImage(
  pageUrl: string
): Promise<string | null> {
  const trimmed = pageUrl.trim()
  if (!trimmed) return null

  let normalizedPageUrl = trimmed
  if (!/^https?:\/\//i.test(normalizedPageUrl)) {
    normalizedPageUrl = `https://${normalizedPageUrl}`
  }

  try {
    const response = await fetch(normalizedPageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; CeliteMarketingBot/1.0; +https://celite.co)",
      },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 3600 },
    })

    if (!response.ok) return null

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.includes("text/html")) return null

    const html = await response.text()
    const metaImage = extractMetaImageUrl(html)
    if (metaImage) {
      return resolveAbsoluteUrl(metaImage, normalizedPageUrl)
    }

    return extractFirstContentImage(html, normalizedPageUrl)
  } catch {
    return null
  }
}
