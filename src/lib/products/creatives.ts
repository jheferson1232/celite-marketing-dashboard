import type { CreativeType } from "@/lib/services/creative"
import type {
  ProductRecord,
  ProductVariantCreativeRecord,
} from "@/lib/services/product"

/** Creativos únicos agregados desde todas las variantes del producto. */
export function flattenProductCreatives(
  product: Pick<ProductRecord, "variants">
): ProductVariantCreativeRecord[] {
  const byId = new Map<string, ProductVariantCreativeRecord>()

  for (const variant of product.variants) {
    for (const creative of variant.creatives) {
      if (!byId.has(creative.id)) byId.set(creative.id, creative)
    }
  }

  return [...byId.values()]
}

export function getProductCreativesByType(
  product: Pick<ProductRecord, "variants">,
  type: CreativeType
): ProductVariantCreativeRecord[] {
  return flattenProductCreatives(product).filter((creative) => creative.type === type)
}

export function getProductImageUrls(product: Pick<ProductRecord, "variants">): string[] {
  return getProductCreativesByType(product, "image").map((creative) => creative.url)
}

export function getProductVideoUrls(product: Pick<ProductRecord, "variants">): string[] {
  return getProductCreativesByType(product, "video").map((creative) => creative.url)
}

export function getProductMediaCounts(product: Pick<ProductRecord, "variants">) {
  const images = getProductCreativesByType(product, "image")
  const videos = getProductCreativesByType(product, "video")
  return {
    imageCount: images.length,
    videoCount: videos.length,
  }
}
