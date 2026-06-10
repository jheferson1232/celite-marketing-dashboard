import { runServerAction } from "@/lib/server-action"
import { uploadCreativeFileClient } from "@/lib/services/blob/creative-client-upload"
import type { CreativeRecord } from "@/lib/services/creative"
import { createCreativeAction } from "../_actions/creatives"

export async function uploadCreativeToBaul(file: File): Promise<CreativeRecord> {
  const uploaded = await uploadCreativeFileClient(file)
  const record = await runServerAction(
    createCreativeAction({
      url: uploaded.url,
      type: uploaded.type,
    })
  )

  if (!record) {
    throw new Error("No se pudo registrar el archivo en el baúl")
  }

  return record
}
