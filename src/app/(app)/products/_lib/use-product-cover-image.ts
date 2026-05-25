"use client"

import { useQuery } from "@tanstack/react-query"
import {
  getCoverLandingUrls,
  getProductCoverImage,
  productNeedsCoverResolve,
} from "@/lib/products/cover-image"
import { runServerAction } from "@/lib/server-action"
import type { ProductRecord } from "@/lib/services/product"
import { resolveProductCoverImageAction } from "../_actions/product-cover"

export function useProductCoverImage(product: ProductRecord) {
  const directCover = getProductCoverImage(product)
  const fallbackVideo = product.videos[0] ?? null
  const shouldResolve = productNeedsCoverResolve(product)
  const landingUrls = getCoverLandingUrls(product)

  const { data: resolvedCover, isLoading } = useQuery({
    queryKey: [
      "product-cover",
      product.id,
      directCover,
      fallbackVideo,
      landingUrls.join("|"),
      product.variants.map((v) => `${v.id}:${v.imageUrl ?? ""}:${v.url}`).join("|"),
    ],
    queryFn: () => runServerAction(resolveProductCoverImageAction(product.id)),
    enabled: shouldResolve,
    staleTime: 60 * 60 * 1000,
  })

  const coverImage = directCover ?? resolvedCover ?? null

  return {
    coverImage,
    coverVideo: coverImage ? null : fallbackVideo,
    isLoadingCover: shouldResolve && isLoading,
  }
}
