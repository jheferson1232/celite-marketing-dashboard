"use server"

import { createServerAction } from "@/lib/server-action"
import { fetchLandingPagePreviewImage } from "@/lib/services/landing-page-preview"
import { getProductById } from "@/lib/services/product"
import { getProductCoverImage } from "@/lib/products/cover-image"

export const resolveProductCoverImageAction = createServerAction(
  async (productId: string): Promise<string | null> => {
    const product = await getProductById(productId)
    if (!product) return null

    const directCover = getProductCoverImage(product)
    if (directCover) return directCover

    for (const landingPage of product.landingPages) {
      const preview = await fetchLandingPagePreviewImage(landingPage.url)
      if (preview) return preview
    }

    return null
  }
)
