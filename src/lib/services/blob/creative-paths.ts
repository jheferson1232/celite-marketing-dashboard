import type { CreativeType } from "@/lib/services/creative"
import { sanitizeFilename } from "@/lib/services/blob/media-utils"

export function buildCreativeBlobPath(
  type: CreativeType,
  creativeId: string | undefined,
  filename: string
): string {
  const prefix = creativeId ? `creatives/${creativeId}` : "creatives/drafts"
  const kind = type === "image" ? "images" : "videos"
  return `${prefix}/${kind}/${Date.now()}-${sanitizeFilename(filename)}`
}

export function isAllowedCreativeBlobPath(pathname: string): boolean {
  return /^creatives\/(?:drafts|[\w-]+)\/(?:images|videos)\/\d+-[\w.-]+$/.test(
    pathname
  )
}

export function creativeTypeFromBlobPath(pathname: string): CreativeType | null {
  if (pathname.includes("/images/")) return "image"
  if (pathname.includes("/videos/")) return "video"
  return null
}
