const META_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["'][^>]*>/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["'][^>]*>/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
  /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/i,
]

const SKIP_IMAGE_HINTS = [
  "pixel",
  "tracking",
  "analytics",
  "logo",
  "icon",
  "favicon",
  "badge",
  "sprite",
  "placeholder",
  "1x1",
  "spacer",
]

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function resolveAbsoluteUrl(rawUrl: string, pageUrl: string): string | null {
  try {
    return new URL(rawUrl, pageUrl).href
  } catch {
    return null
  }
}

function normalizePageUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function isUsableImageUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (lower.startsWith("data:")) return false
  if (lower.endsWith(".svg")) return false
  if (lower.includes("facebook.com/tr")) return false
  if (lower.includes("google-analytics.com")) return false
  if (lower.includes("doubleclick.net")) return false
  if (lower.includes("noscript=1")) return false
  return !SKIP_IMAGE_HINTS.some((hint) => lower.includes(hint))
}

function scoreImageUrl(url: string): number {
  const lower = url.toLowerCase()
  let score = 0
  if (lower.includes("/products/")) score += 4
  if (lower.includes("cdn.shopify.com")) score += 3
  if (lower.includes("og_image") || lower.includes("featured")) score += 2
  if (lower.includes("_grande") || lower.includes("_1024x")) score += 2
  if (lower.includes("thumb") || lower.includes("_small") || lower.includes("_icon")) {
    score -= 3
  }
  if (lower.includes("width=60") || lower.includes("width=80")) score -= 2
  return score
}

function pushUniqueImage(
  bucket: string[],
  seen: Set<string>,
  rawUrl: string | null | undefined,
  pageUrl: string
) {
  if (!rawUrl) return
  const absolute = resolveAbsoluteUrl(decodeHtmlEntities(rawUrl.trim()), pageUrl)
  if (!absolute || !isUsableImageUrl(absolute) || seen.has(absolute)) return
  seen.add(absolute)
  bucket.push(absolute)
}

function extractMetaImageUrl(html: string): string | null {
  for (const pattern of META_IMAGE_PATTERNS) {
    const match = html.match(pattern)
    const raw = match?.[1]?.trim()
    if (raw) return decodeHtmlEntities(raw)
  }
  return null
}

function collectImagesFromJsonLd(
  data: unknown,
  out: string[],
  seen: Set<string>,
  pageUrl: string
) {
  if (!data) return

  if (Array.isArray(data)) {
    for (const item of data) collectImagesFromJsonLd(item, out, seen, pageUrl)
    return
  }

  if (typeof data !== "object") return

  const obj = data as Record<string, unknown>
  if (obj["@graph"]) {
    collectImagesFromJsonLd(obj["@graph"], out, seen, pageUrl)
  }

  const image = obj.image
  if (typeof image === "string") {
    pushUniqueImage(out, seen, image, pageUrl)
  } else if (Array.isArray(image)) {
    for (const item of image) {
      if (typeof item === "string") {
        pushUniqueImage(out, seen, item, pageUrl)
      } else if (item && typeof item === "object" && "url" in item) {
        pushUniqueImage(out, seen, String((item as { url: string }).url), pageUrl)
      }
    }
  } else if (image && typeof image === "object" && "url" in image) {
    pushUniqueImage(out, seen, String((image as { url: string }).url), pageUrl)
  }

  for (const key of ["product", "products", "item", "mainEntity"]) {
    if (key in obj) collectImagesFromJsonLd(obj[key], out, seen, pageUrl)
  }
}

function extractJsonLdImages(html: string, pageUrl: string, seen: Set<string>): string[] {
  const images: string[] = []
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )

  for (const match of scripts) {
    try {
      collectImagesFromJsonLd(JSON.parse(match[1]), images, seen, pageUrl)
    } catch {
      continue
    }
  }

  return images
}

function extractContentImages(html: string, pageUrl: string, seen: Set<string>): string[] {
  const images: string[] = []
  const patterns = [
    /<img[^>]+(?:data-src|data-original|src)=["']([^"']+)["'][^>]*>/gi,
    /<source[^>]+srcset=["']([^"']+)["'][^>]*>/gi,
  ]

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const raw = match[1].split(",")[0]?.trim().split(/\s+/)[0]
      pushUniqueImage(images, seen, raw, pageUrl)
    }
  }

  return images
}

function extractFirstProductPageUrl(html: string, pageUrl: string): string | null {
  const matches = html.matchAll(/href=["']([^"']*\/products\/[^"'?#]+)["']/gi)
  for (const match of matches) {
    const resolved = resolveAbsoluteUrl(match[1], pageUrl)
    if (resolved) return resolved
  }
  return null
}

function rankImages(images: string[]): string[] {
  return [...images].sort((a, b) => scoreImageUrl(b) - scoreImageUrl(a))
}

async function fetchHtml(pageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(pageUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 3600 },
    })

    if (!response.ok) return null

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.includes("text/html")) return null

    return response.text()
  } catch {
    return null
  }
}

function extractImagesFromHtml(html: string, pageUrl: string): string[] {
  const seen = new Set<string>()
  const images: string[] = []

  pushUniqueImage(images, seen, extractMetaImageUrl(html), pageUrl)
  images.push(...extractJsonLdImages(html, pageUrl, seen))
  images.push(...extractContentImages(html, pageUrl, seen))

  return rankImages(images)
}

export type StorePreviewImages = {
  images: string[]
  title: string | null
}

export type StoreProductPreview = StorePreviewImages & {
  price: number | null
  currency: string | null
  publishedAt: string | null
  productUrl: string | null
}

function parseJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = []
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )

  for (const match of scripts) {
    try {
      blocks.push(JSON.parse(match[1]))
    } catch {
      continue
    }
  }

  return blocks
}

function isProductType(type: unknown): boolean {
  if (typeof type === "string") return type.toLowerCase().includes("product")
  if (Array.isArray(type)) {
    return type.some((item) => typeof item === "string" && item.toLowerCase().includes("product"))
  }
  return false
}

function findProductNode(data: unknown): Record<string, unknown> | null {
  if (!data) return null

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findProductNode(item)
      if (found) return found
    }
    return null
  }

  if (typeof data !== "object") return null

  const obj = data as Record<string, unknown>
  if (isProductType(obj["@type"])) return obj

  if (obj["@graph"]) {
    const fromGraph = findProductNode(obj["@graph"])
    if (fromGraph) return fromGraph
  }

  for (const key of ["product", "products", "item", "mainEntity"]) {
    if (key in obj) {
      const found = findProductNode(obj[key])
      if (found) return found
    }
  }

  return null
}

function pickOfferFields(
  offers: unknown
): { price: number | null; currency: string | null } {
  const rows = Array.isArray(offers) ? offers : offers ? [offers] : []

  for (const offer of rows) {
    if (!offer || typeof offer !== "object") continue
    const row = offer as Record<string, unknown>
    const rawPrice = row.price ?? row.lowPrice ?? row.highPrice
    const price =
      typeof rawPrice === "number"
        ? rawPrice
        : typeof rawPrice === "string"
          ? Number.parseFloat(rawPrice.replace(/[^\d.,]/g, "").replace(",", "."))
          : null
    const currency =
      typeof row.priceCurrency === "string"
        ? row.priceCurrency
        : typeof row.currency === "string"
          ? row.currency
          : null

    if (price != null && Number.isFinite(price)) {
      return { price, currency }
    }
  }

  return { price: null, currency: null }
}

function extractProductMeta(html: string): {
  title: string | null
  price: number | null
  currency: string | null
  publishedAt: string | null
} {
  const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  let title = titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : null
  let price: number | null = null
  let currency: string | null = null
  let publishedAt: string | null = null

  const priceAmountMatch = html.match(
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i
  )
  if (priceAmountMatch?.[1]) {
    const parsed = Number.parseFloat(priceAmountMatch[1])
    if (Number.isFinite(parsed)) price = parsed
  }

  const priceCurrencyMatch = html.match(
    /<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([^"']+)["']/i
  )
  if (priceCurrencyMatch?.[1]) currency = priceCurrencyMatch[1]

  for (const block of parseJsonLdBlocks(html)) {
    const product = findProductNode(block)
    if (!product) continue

    if (!title && typeof product.name === "string") {
      title = decodeHtmlEntities(product.name)
    }

    const offerFields = pickOfferFields(product.offers)
    if (price == null && offerFields.price != null) price = offerFields.price
    if (!currency && offerFields.currency) currency = offerFields.currency

    const datePublished =
      typeof product.datePublished === "string"
        ? product.datePublished
        : typeof product.releaseDate === "string"
          ? product.releaseDate
          : null
    if (!publishedAt && datePublished) publishedAt = datePublished
  }

  const createdAtMatch = html.match(/"created_at"\s*:\s*"([^"]+)"/i)
  if (!publishedAt && createdAtMatch?.[1]) {
    publishedAt = createdAtMatch[1]
  }

  return { title, price, currency, publishedAt }
}

function buildStoreProductPreview(
  html: string,
  pageUrl: string,
  productUrl: string | null
): StoreProductPreview {
  const meta = extractProductMeta(html)
  const images = extractImagesFromHtml(html, pageUrl)

  return {
    images: images.slice(0, 8),
    title: meta.title,
    price: meta.price,
    currency: meta.currency,
    publishedAt: meta.publishedAt,
    productUrl,
  }
}

export async function fetchStoreProductPreview(
  pageUrl: string
): Promise<StoreProductPreview> {
  const normalizedPageUrl = normalizePageUrl(pageUrl)
  if (!normalizedPageUrl) {
    return {
      images: [],
      title: null,
      price: null,
      currency: null,
      publishedAt: null,
      productUrl: null,
    }
  }

  const html = await fetchHtml(normalizedPageUrl)
  if (!html) {
    return {
      images: [],
      title: null,
      price: null,
      currency: null,
      publishedAt: null,
      productUrl: null,
    }
  }

  const isLikelyHome =
    !normalizedPageUrl.includes("/products/") &&
    !normalizedPageUrl.includes("/product/")

  if (isLikelyHome) {
    const productPageUrl = extractFirstProductPageUrl(html, normalizedPageUrl)
    if (productPageUrl && productPageUrl !== normalizedPageUrl) {
      const productHtml = await fetchHtml(productPageUrl)
      if (productHtml) {
        const preview = buildStoreProductPreview(productHtml, productPageUrl, productPageUrl)
        if (preview.images.length > 0 || preview.title) return preview
      }
    }
  }

  const productUrl = isLikelyHome ? null : normalizedPageUrl
  return buildStoreProductPreview(html, normalizedPageUrl, productUrl)
}

export async function fetchStorePreviewImages(
  pageUrl: string
): Promise<StorePreviewImages> {
  const preview = await fetchStoreProductPreview(pageUrl)
  return { images: preview.images, title: preview.title }
}

export async function fetchLandingPagePreviewImage(
  pageUrl: string
): Promise<string | null> {
  const result = await fetchStoreProductPreview(pageUrl)
  return result.images[0] ?? null
}
