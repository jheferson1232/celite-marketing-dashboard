import { upload } from "@vercel/blob/client"
import type { CreativeType } from "@/lib/services/creative"
import { buildCreativeBlobPath } from "@/lib/services/blob/creative-paths"
import {
  detectCreativeType,
  normalizeCreativeFile,
  validateMediaFile,
} from "@/lib/services/blob/media-utils"

const CREATIVE_UPLOAD_URL = "/api/blob/creative-upload"

export type CreativeClientUploadResult = {
  url: string
  type: CreativeType
}

export async function uploadCreativeFileClient(
  file: File
): Promise<CreativeClientUploadResult> {
  const normalizedFile = normalizeCreativeFile(file)
  const type = detectCreativeType(normalizedFile)
  validateMediaFile(normalizedFile, type)

  const pathname = buildCreativeBlobPath(type, undefined, normalizedFile.name)
  const useMultipart =
    type === "video" || normalizedFile.size > 5 * 1024 * 1024

  const blob = await upload(pathname, normalizedFile, {
    access: "public",
    handleUploadUrl: CREATIVE_UPLOAD_URL,
    clientPayload: JSON.stringify({ type }),
    multipart: useMultipart,
  })

  return { url: blob.url, type }
}
