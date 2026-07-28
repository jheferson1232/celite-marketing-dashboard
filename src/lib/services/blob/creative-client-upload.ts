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

type PresignResponse = {
  uploadUrl: string
  publicUrl: string
}

async function requestPresign(params: {
  pathname: string
  contentType: string
  type: CreativeType
}): Promise<PresignResponse> {
  const response = await fetch(CREATIVE_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const message =
      (await response.json().catch(() => null))?.error ??
      "No se pudo preparar la subida"
    throw new Error(message)
  }

  return (await response.json()) as PresignResponse
}

export async function uploadCreativeFileClient(
  file: File
): Promise<CreativeClientUploadResult> {
  const normalizedFile = normalizeCreativeFile(file)
  const type = detectCreativeType(normalizedFile)
  validateMediaFile(normalizedFile, type)

  const pathname = buildCreativeBlobPath(type, undefined, normalizedFile.name)
  const contentType = normalizedFile.type || undefined

  const { uploadUrl, publicUrl } = await requestPresign({
    pathname,
    contentType: contentType ?? "",
    type,
  })

  let uploadResponse: Response
  try {
    uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: contentType ? { "Content-Type": contentType } : undefined,
      body: normalizedFile,
    })
  } catch {
    throw new Error(
      "No se pudo subir a R2 (Failed to fetch). Revisá la política CORS del bucket en Cloudflare."
    )
  }

  if (!uploadResponse.ok) {
    throw new Error(
      `Falló la subida a R2 (HTTP ${uploadResponse.status})`
    )
  }

  return { url: publicUrl, type }
}
