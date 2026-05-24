"use server"

import { createServerAction } from "@/lib/server-action"
import {
  deleteProductMedia,
  formDataToUploadInput,
  uploadProductMedia,
  type ProductMediaUploadResult,
} from "@/lib/services/blob/product-media"

export const uploadProductMediaAction = createServerAction(
  async (formData: FormData): Promise<ProductMediaUploadResult> => {
    const productId = formData.get("productId")
    const input = formDataToUploadInput(
      formData,
      typeof productId === "string" && productId.trim()
        ? productId.trim()
        : undefined
    )

    return uploadProductMedia(input)
  }
)

export const deleteProductMediaAction = createServerAction(
  async (urls: string[]): Promise<void> => deleteProductMedia(urls)
)
