import { ServerActionError } from "@/lib/server-action"
import type { CreativeType } from "@/lib/services/creative"
import { buildCreativeBlobPath } from "@/lib/services/blob/creative-paths"
import {
  assertR2Configured,
} from "@/lib/services/r2/client"
import { deleteR2Object, putR2Object } from "@/lib/services/r2/server"
import {
  detectCreativeType,
  normalizeCreativeFile,
  validateMediaFile,
} from "@/lib/services/blob/media-utils"

export type CreativeMediaUploadInput = {
  creativeId?: string
  type: CreativeType
  files: File[]
}

export async function uploadCreativeMedia(
  input: CreativeMediaUploadInput
): Promise<string[]> {
  assertR2Configured()

  if (input.files.length === 0) {
    throw new ServerActionError("No se recibió ningún archivo")
  }

  const normalizedFiles = input.files.map((file) => normalizeCreativeFile(file))

  for (const file of normalizedFiles) {
    validateMediaFile(file, input.type)
  }

  return Promise.all(
    normalizedFiles.map(async (file) => {
      const key = buildCreativeBlobPath(input.type, input.creativeId, file.name)
      return putR2Object(key, file, { contentType: file.type || undefined })
    })
  )
}

export async function deleteCreativeMedia(url: string): Promise<void> {
  const trimmed = url.trim()
  if (!trimmed) return

  assertR2Configured()
  await deleteR2Object(trimmed)
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
    const file = normalizeCreativeFile(fileEntry)
    return {
      creativeId,
      type: detectCreativeType(file),
      files: [file],
    }
  }

  throw new ServerActionError("No se recibió ningún archivo")
}
