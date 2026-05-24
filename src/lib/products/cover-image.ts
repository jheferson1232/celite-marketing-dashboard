import type { ProductRecord } from "@/lib/services/product"

export function getProductCoverImage(product: Pick<ProductRecord, "images" | "imageUrl">): string | null {
  return product.images[0] ?? product.imageUrl ?? null
}

export function getProductMediaCounts(product: Pick<ProductRecord, "images" | "videos">) {
  return {
    imageCount: product.images.length,
    videoCount: product.videos.length,
  }
}
