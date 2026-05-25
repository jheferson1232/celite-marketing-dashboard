"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getCoverLandingUrls,
  getProductCoverImage,
} from "@/lib/products/cover-image"
import { fetchLandingPagePreviewImage } from "@/lib/services/landing-page-preview"
import { getProductById } from "@/lib/services/product"

export const resolveProductCoverImageAction = createServerAction(
  async (productId: string): Promise<string | null> => {
    const product = await getProductById(productId)
    if (!product) return null

    const directCover = getProductCoverImage(product)
    if (directCover) return directCover

    for (const url of getCoverLandingUrls(product)) {
      const preview = await fetchLandingPagePreviewImage(url)
      if (preview) return preview
    }

    return null
  }
)
