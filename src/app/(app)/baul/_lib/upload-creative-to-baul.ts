import { runServerAction } from "@/lib/server-action"
import type { CreativeRecord } from "@/lib/services/creative"
import { uploadCreativeAction } from "../_actions/creatives"

export async function uploadCreativeToBaul(file: File): Promise<CreativeRecord> {
  const formData = new FormData()
  formData.append("file", file)

  const record = await runServerAction(uploadCreativeAction(formData))
  if (!record) {
    throw new Error("No se pudo registrar el archivo en el baúl")
  }

  return record
}
