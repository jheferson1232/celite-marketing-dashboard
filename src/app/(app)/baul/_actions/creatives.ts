"use server"

import { createServerAction } from "@/lib/server-action"
import { formDataToCreativeUploadInput } from "@/lib/services/blob/creative-media"
import {
  createCreativeFromUpload,
  deleteCreative,
  getCreativeById,
  listCreatives,
  setCreativeVariants,
  updateCreative,
  type CreativeRecord,
} from "@/lib/services/creative"

export const listCreativesAction = createServerAction(
  async (): Promise<CreativeRecord[]> => listCreatives()
)

export const createCreativeAction = createServerAction(
  async (formData: FormData): Promise<CreativeRecord> => {
    const input = formDataToCreativeUploadInput(formData)

    if (input.files.length !== 1) {
      throw new Error("Sube un archivo a la vez")
    }

    return createCreativeFromUpload({
      type: input.type,
      file: input.files[0]!,
    })
  }
)

export const updateCreativeAction = createServerAction(
  async (input: {
    id: string
    name?: string | null
    variantIds?: string[]
  }): Promise<CreativeRecord> => {
    if (input.variantIds !== undefined) {
      await setCreativeVariants(input.id, input.variantIds)
    }

    if (input.name !== undefined) {
      return updateCreative({
        id: input.id,
        name: input.name,
      })
    }

    const creative = await getCreativeById(input.id)
    if (!creative) throw new Error("Creative no encontrado")
    return creative
  }
)

export const deleteCreativeAction = createServerAction(
  async (id: string): Promise<void> => deleteCreative(id)
)
