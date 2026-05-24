"use client"

import { useQuery } from "@tanstack/react-query"
import { getProductCoverImage } from "@/lib/products/cover-image"
import { runServerAction } from "@/lib/server-action"
import type { ProductRecord } from "@/lib/services/product"
import { resolveProductCoverImageAction } from "../_actions/product-cover"

export function useProductCoverImage(product: ProductRecord) {
  const directCover = getProductCoverImage(product)
  const hasLandingPages = product.landingPages.length > 0

  const { data: resolvedCover, isLoading } = useQuery({
    queryKey: [
      "product-cover",
      product.id,
      directCover,
      product.landingPages.map((page) => page.url).join("|"),
    ],
    queryFn: () => runServerAction(resolveProductCoverImageAction(product.id)),
    enabled: !directCover && hasLandingPages,
    staleTime: 60 * 60 * 1000,
  })

  return {
    coverImage: directCover ?? resolvedCover ?? null,
    isLoadingCover: !directCover && hasLandingPages && isLoading,
  }
}
