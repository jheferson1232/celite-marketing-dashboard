import type { ProductRecord } from "@/lib/services/product"
import { extractUrlSlug, normalizeMatchKey } from "@/lib/url-match"

type ProductWithVariants = Pick<
  ProductRecord,
  "name" | "images" | "imageUrl" | "videos" | "variants" | "landingPages"
>

/** Variante que mejor coincide con el nombre del producto (cada producto = una variante). */
export function pickPrimaryVariant(
  product: Pick<ProductRecord, "name" | "variants">
): ProductRecord["variants"][number] | null {
  if (product.variants.length === 0) return null
  if (product.variants.length === 1) return product.variants[0]!

  const nameKey = normalizeMatchKey(product.name)

  for (const variant of product.variants) {
    const slugKey = normalizeMatchKey(extractUrlSlug(variant.url))
    const colorKey = normalizeMatchKey(variant.color)
    if (slugKey && nameKey.includes(slugKey)) return variant
    if (colorKey && nameKey.includes(colorKey)) return variant
  }

  return product.variants[0]!
}

export function getProductCoverImage(
  product: Pick<ProductRecord, "name" | "images" | "imageUrl" | "variants">
): string | null {
  const fromProduct = product.images[0] ?? product.imageUrl ?? null
  if (fromProduct) return fromProduct

  const primary = pickPrimaryVariant(product)
  if (primary?.imageUrl) return primary.imageUrl

  for (const variant of product.variants) {
    if (variant.imageUrl) return variant.imageUrl
  }

  return null
}

export function getProductMediaCounts(product: Pick<ProductRecord, "images" | "videos">) {
  return {
    imageCount: product.images.length,
    videoCount: product.videos.length,
  }
}

/** URLs de landing a probar para portada (variante principal primero). */
export function getCoverLandingUrls(product: ProductWithVariants): string[] {
  const seen = new Set<string>()
  const urls: string[] = []

  const add = (raw: string) => {
    const url = raw.trim()
    if (!url) return
    const key = url.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    urls.push(url)
  }

  const primary = pickPrimaryVariant(product)
  if (primary?.url) add(primary.url)

  for (const variant of product.variants) add(variant.url)
  for (const page of product.landingPages) add(page.url)

  return urls
}

export function productNeedsCoverResolve(product: ProductWithVariants): boolean {
  if (getProductCoverImage(product)) return false
  if (product.videos.length > 0) return false
  return getCoverLandingUrls(product).length > 0
}
