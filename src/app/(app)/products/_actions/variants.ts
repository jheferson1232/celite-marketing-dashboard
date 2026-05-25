"use server"

import { createServerAction } from "@/lib/server-action"
import {
  attachCreativeToProductVariant,
  detachCreativeFromProductVariant,
  updateProductVariant,
  type ProductRecord,
  type UpdateProductVariantInput,
} from "@/lib/services/product"

export const updateProductVariantAction = createServerAction(
  async (input: UpdateProductVariantInput): Promise<ProductRecord> =>
    updateProductVariant(input)
)

export const attachVariantCreativeAction = createServerAction(
  async (input: {
    variantId: string
    creativeId: string
  }): Promise<ProductRecord> =>
    attachCreativeToProductVariant(input.variantId, input.creativeId)
)

export const detachVariantCreativeAction = createServerAction(
  async (input: {
    variantId: string
    creativeId: string
  }): Promise<ProductRecord> =>
    detachCreativeFromProductVariant(input.variantId, input.creativeId)
)
