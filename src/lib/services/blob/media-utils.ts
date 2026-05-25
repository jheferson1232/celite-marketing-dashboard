import { ServerActionError } from "@/lib/server-action"
import type { CreativeType } from "@/lib/services/creative"

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const

export const CREATIVE_IMAGE_ACCEPT = IMAGE_MIME_TYPES.join(",")
export const CREATIVE_VIDEO_ACCEPT = VIDEO_MIME_TYPES.join(",")
export const CREATIVE_MEDIA_ACCEPT = [
  ...IMAGE_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
].join(",")

const IMAGE_MIME_TYPE_SET = new Set<string>(IMAGE_MIME_TYPES)
const VIDEO_MIME_TYPE_SET = new Set<string>(VIDEO_MIME_TYPES)

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024

export function getCreativeUploadLimits(type: CreativeType): {
  allowedContentTypes: string[]
  maximumSizeInBytes: number
} {
  return {
    allowedContentTypes:
      type === "image" ? [...IMAGE_MIME_TYPES] : [...VIDEO_MIME_TYPES],
    maximumSizeInBytes: type === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES,
  }
}

export function assertBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new ServerActionError(
      "BLOB_READ_WRITE_TOKEN no está configurado. Añádelo en Vercel o .env local."
    )
  }
}

export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "file"
}

export function detectCreativeType(file: File): CreativeType {
  if (IMAGE_MIME_TYPE_SET.has(file.type)) return "image"
  if (VIDEO_MIME_TYPE_SET.has(file.type)) return "video"

  throw new ServerActionError(
    `Tipo de archivo no permitido (${file.name}): ${file.type || "desconocido"}`
  )
}

export function validateMediaFile(file: File, type: CreativeType): void {
  const detectedType = detectCreativeType(file)

  if (detectedType !== type) {
    throw new ServerActionError(
      `El archivo ${file.name} no coincide con el tipo esperado (${type})`
    )
  }

  const maxBytes = type === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES

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
