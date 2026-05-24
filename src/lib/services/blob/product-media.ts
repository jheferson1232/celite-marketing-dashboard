import { del, put } from "@vercel/blob"
import { ServerActionError } from "@/lib/server-action"

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
])

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024
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

function assertBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new ServerActionError(
      "BLOB_READ_WRITE_TOKEN no está configurado. Añádelo en Vercel o .env local."
    )
  }
}

function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "file"
}

function buildBlobPath(
  kind: "images" | "videos",
  productId: string | undefined,
  filename: string
): string {
  const prefix = productId ? `products/${productId}` : "products/drafts"
  return `${prefix}/${kind}/${Date.now()}-${sanitizeFilename(filename)}`
}

function validateFile(
  file: File,
  kind: "image" | "video"
): void {
  const allowed =
    kind === "image" ? IMAGE_MIME_TYPES : VIDEO_MIME_TYPES
  const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES

  if (!allowed.has(file.type)) {
    throw new ServerActionError(
      `Tipo de archivo no permitido (${file.name}): ${file.type || "desconocido"}`
    )
  }

  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024))
    throw new ServerActionError(
      `${file.name} supera el límite de ${limitMb} MB`
    )
  }
}

export function sanitizeMediaUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return []
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of urls) {
    const url = raw.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    result.push(url)
  }

  return result
}

export async function uploadProductMedia(
  input: ProductMediaUploadInput
): Promise<ProductMediaUploadResult> {
  assertBlobConfigured()

  if (input.imageFiles.length > MAX_IMAGES) {
    throw new ServerActionError(`Máximo ${MAX_IMAGES} imágenes por producto`)
  }

  if (input.videoFiles.length > MAX_VIDEOS) {
    throw new ServerActionError(`Máximo ${MAX_VIDEOS} videos por producto`)
  }

  for (const file of input.imageFiles) validateFile(file, "image")
  for (const file of input.videoFiles) validateFile(file, "video")

  const token = process.env.BLOB_READ_WRITE_TOKEN!

  const [images, videos] = await Promise.all([
    Promise.all(
      input.imageFiles.map(async (file) => {
        const blob = await put(
          buildBlobPath("images", input.productId, file.name),
          file,
          { access: "public", token }
        )
        return blob.url
      })
    ),
    Promise.all(
      input.videoFiles.map(async (file) => {
        const blob = await put(
          buildBlobPath("videos", input.productId, file.name),
          file,
          { access: "public", token }
        )
        return blob.url
      })
    ),
  ])

  return { images, videos }
}

export async function deleteProductMedia(urls: string[]): Promise<void> {
  const sanitized = sanitizeMediaUrls(urls)
  if (sanitized.length === 0) return

  assertBlobConfigured()

  const token = process.env.BLOB_READ_WRITE_TOKEN!
  const blobUrls = sanitized.filter((url) =>
    url.includes("blob.vercel-storage.com")
  )

  if (blobUrls.length === 0) return

  await Promise.all(
    blobUrls.map((url) =>
      del(url, { token }).catch((error) => {
        console.error("No se pudo eliminar blob:", url, error)
      })
    )
  )
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
