import { del, put } from "@vercel/blob"
import { ServerActionError } from "@/lib/server-action"
import type { CreativeType } from "@/lib/services/creative"
import {
  assertBlobConfigured,
  detectCreativeType,
  sanitizeFilename,
  validateMediaFile,
} from "@/lib/services/blob/media-utils"

export type CreativeMediaUploadInput = {
  creativeId?: string
  type: CreativeType
  files: File[]
}

function buildCreativeBlobPath(
  type: CreativeType,
  creativeId: string | undefined,
  filename: string
): string {
  const prefix = creativeId ? `creatives/${creativeId}` : "creatives/drafts"
  const kind = type === "image" ? "images" : "videos"
  return `${prefix}/${kind}/${Date.now()}-${sanitizeFilename(filename)}`
}

export async function uploadCreativeMedia(
  input: CreativeMediaUploadInput
): Promise<string[]> {
  assertBlobConfigured()

  if (input.files.length === 0) {
    throw new ServerActionError("No se recibió ningún archivo")
  }

  for (const file of input.files) {
    validateMediaFile(file, input.type)
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN!

  return Promise.all(
    input.files.map(async (file) => {
      const blob = await put(
        buildCreativeBlobPath(input.type, input.creativeId, file.name),
        file,
        { access: "public", token }
      )
      return blob.url
    })
  )
}

export async function deleteCreativeMedia(url: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed || !trimmed.includes("blob.vercel-storage.com")) return

  assertBlobConfigured()

  const token = process.env.BLOB_READ_WRITE_TOKEN!
  await del(trimmed, { token }).catch((error) => {
    console.error("No se pudo eliminar blob:", trimmed, error)
  })
}

export function formDataToCreativeUploadInput(
  formData: FormData
): CreativeMediaUploadInput {
  const creativeIdRaw = formData.get("creativeId")
  const creativeId =
    typeof creativeIdRaw === "string" && creativeIdRaw.trim()
      ? creativeIdRaw.trim()
      : undefined

  const fileEntry = formData.get("file")
  if (fileEntry instanceof File && fileEntry.size > 0) {
    return {
      creativeId,
      type: detectCreativeType(fileEntry),
      files: [fileEntry],
    }
  }

  throw new ServerActionError("No se recibió ningún archivo")
}
