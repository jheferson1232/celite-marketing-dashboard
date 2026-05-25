import { upload } from "@vercel/blob/client"
import type { CreativeType } from "@/lib/services/creative"
import { buildCreativeBlobPath } from "@/lib/services/blob/creative-paths"
import {
  detectCreativeType,
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
  const type = detectCreativeType(file)
  validateMediaFile(file, type)

  const pathname = buildCreativeBlobPath(type, undefined, file.name)
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: CREATIVE_UPLOAD_URL,
    clientPayload: JSON.stringify({ type }),
  })

  return { url: blob.url, type }
}
