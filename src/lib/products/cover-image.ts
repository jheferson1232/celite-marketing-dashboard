import {
  getProductCreativesByType,
  getProductMediaCounts,
} from "@/lib/products/creatives"
import type { ProductRecord } from "@/lib/services/product"
import { normalizeMatchKey } from "@/lib/url-match"

type ProductWithVariants = Pick<
  ProductRecord,
  "name" | "variants" | "landingPages"
>

/** Variante que mejor coincide con el nombre del producto (cada producto = una variante). */
export function pickPrimaryVariant(
  product: Pick<ProductRecord, "name" | "variants">
): ProductRecord["variants"][number] | null {
  if (product.variants.length === 0) return null
  if (product.variants.length === 1) return product.variants[0]!

  const nameKey = normalizeMatchKey(product.name)

  for (const variant of product.variants) {
    const variantNameKey = normalizeMatchKey(variant.name)
    if (variantNameKey && nameKey.includes(variantNameKey)) return variant
  }

  return product.variants[0]!
}

export function getProductCoverImage(
  product: Pick<ProductRecord, "name" | "variants">
): string | null {
  const imageCreatives = getProductCreativesByType(product, "image")
  if (imageCreatives[0]?.url) return imageCreatives[0].url

  return null
}

export { getProductMediaCounts }

/** URLs de landing a probar para portada (producto). */
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

  for (const page of product.landingPages) add(page.url)

  return urls
}

export function productNeedsCoverResolve(product: ProductWithVariants): boolean {
  if (getProductCoverImage(product)) return false
  if (getProductCreativesByType(product, "video").length > 0) return false
  return getCoverLandingUrls(product).length > 0
}
