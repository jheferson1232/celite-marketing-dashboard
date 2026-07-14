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
  "video/*",
  ".mp4",
  ".m4v",
  ".mov",
  ".webm",
].join(",")

const IMAGE_MIME_TYPE_SET = new Set<string>(IMAGE_MIME_TYPES)
const VIDEO_MIME_TYPE_SET = new Set<string>(VIDEO_MIME_TYPES)

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
}

const MIME_ALIASES: Record<string, string> = {
  "video/x-m4v": "video/mp4",
  "video/3gpp": "video/mp4",
  "video/3gpp2": "video/mp4",
}

export function resolveCreativeMimeType(file: File): string {
  const direct = file.type.trim().toLowerCase()
  const aliased = direct ? (MIME_ALIASES[direct] ?? direct) : direct

  if (
    aliased &&
    (IMAGE_MIME_TYPE_SET.has(aliased) || VIDEO_MIME_TYPE_SET.has(aliased))
  ) {
    return aliased
  }

  const extension = file.name.split(".").pop()?.toLowerCase()
  if (extension && EXTENSION_TO_MIME[extension]) {
    return EXTENSION_TO_MIME[extension]
  }

  return aliased
}

export function normalizeCreativeFile(file: File): File {
  const mime = resolveCreativeMimeType(file)
  if (!mime || mime === file.type) return file

  return new File([file], file.name, {
    type: mime,
    lastModified: file.lastModified,
  })
}

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
  if (
    !process.env.R2_ACCOUNT_ID?.trim() ||
    !process.env.R2_ACCESS_KEY_ID?.trim() ||
    !process.env.R2_SECRET_ACCESS_KEY?.trim() ||
    !process.env.R2_BUCKET_NAME?.trim()
  ) {
    throw new ServerActionError(
      "Cloudflare R2 no está configurado. Añadí R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME y R2_PUBLIC_BASE_URL en .env."
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
  const mime = resolveCreativeMimeType(file)
  if (IMAGE_MIME_TYPE_SET.has(mime)) return "image"
  if (VIDEO_MIME_TYPE_SET.has(mime)) return "video"

  throw new ServerActionError(
    `Tipo de archivo no permitido (${file.name}). Usa JPG, PNG, WebP, GIF, MP4, WebM o MOV.`
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
