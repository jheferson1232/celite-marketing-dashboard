import { ServerActionError } from "@/lib/server-action"
import { assertR2Configured } from "@/lib/services/r2/client"
import { deleteR2Object, putR2Object } from "@/lib/services/r2/server"
import {
  sanitizeFilename,
  sanitizeMediaUrls,
  validateMediaFile,
} from "@/lib/services/blob/media-utils"

const MAX_IMAGES = 20
const MAX_VIDEOS = 10

export type ProductMediaUploadInput = {
  productId?: string
  imageFiles: File[]
  videoFiles: File[]
}

export type ProductMediaUploadResult = {
  images: string[]
  videos: string[]
}

function buildBlobPath(
  kind: "images" | "videos",
  productId: string | undefined,
  filename: string
): string {
  const prefix = productId ? `products/${productId}` : "products/drafts"
  return `${prefix}/${kind}/${Date.now()}-${sanitizeFilename(filename)}`
}

export async function uploadProductMedia(
  input: ProductMediaUploadInput
): Promise<ProductMediaUploadResult> {
  assertR2Configured()

  if (input.imageFiles.length > MAX_IMAGES) {
    throw new ServerActionError(`Máximo ${MAX_IMAGES} imágenes por producto`)
  }

  if (input.videoFiles.length > MAX_VIDEOS) {
    throw new ServerActionError(`Máximo ${MAX_VIDEOS} videos por producto`)
  }

  for (const file of input.imageFiles) validateMediaFile(file, "image")
  for (const file of input.videoFiles) validateMediaFile(file, "video")

  const [images, videos] = await Promise.all([
    Promise.all(
      input.imageFiles.map(async (file) => {
        return putR2Object(
          buildBlobPath("images", input.productId, file.name),
          file,
          { contentType: file.type || undefined }
        )
      })
    ),
    Promise.all(
      input.videoFiles.map(async (file) => {
        return putR2Object(
          buildBlobPath("videos", input.productId, file.name),
          file,
          { contentType: file.type || undefined }
        )
      })
    ),
  ])

  return { images, videos }
}

export async function deleteProductMedia(urls: string[]): Promise<void> {
  const sanitized = sanitizeMediaUrls(urls)
  if (sanitized.length === 0) return

  assertR2Configured()

  await Promise.all(sanitized.map((url) => deleteR2Object(url)))
}

export function formDataToUploadInput(
  formData: FormData,
  productId?: string
): ProductMediaUploadInput {
  const imageFiles = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
  const videoFiles = formData
    .getAll("videos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)

  return { productId, imageFiles, videoFiles }
}

export { sanitizeMediaUrls }
