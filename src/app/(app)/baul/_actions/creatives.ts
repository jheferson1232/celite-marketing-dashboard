"use server"

import { createServerAction } from "@/lib/server-action"
import { formDataToCreativeUploadInput } from "@/lib/services/blob/creative-media"
import {
  createCreativeFromUpload,
  createCreativeFromUrl,
  deleteCreative,
  getCreativeById,
  listCreatives,
  setCreativeVariants,
  updateCreative,
  type CreativeRecord,
  type CreativeType,
} from "@/lib/services/creative"

export const listCreativesAction = createServerAction(
  async (): Promise<CreativeRecord[]> => listCreatives()
)

export const uploadCreativeAction = createServerAction(
  async (formData: FormData): Promise<CreativeRecord> => {
    const input = formDataToCreativeUploadInput(formData)
    const file = input.files[0]
    if (!file) throw new Error("No se recibió ningún archivo")

    return createCreativeFromUpload({
      type: input.type,
      file,
    })
  }
)

export const createCreativeAction = createServerAction(
  async (input: {
    url: string
    type: CreativeType
    name?: string | null
  }): Promise<CreativeRecord> => {
    return createCreativeFromUrl({
      url: input.url,
      type: input.type,
      name: input.name,
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
