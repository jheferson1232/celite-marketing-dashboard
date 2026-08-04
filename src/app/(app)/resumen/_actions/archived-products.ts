"use server"

import { createServerAction } from "@/lib/server-action"
import {
  archiveSummaryProduct,
  listArchivedSummaryProducts,
  mergeArchivedSummaryProducts,
  unarchiveSummaryProduct,
} from "@/lib/services/summary/archived-products"

export const listArchivedSummaryProductsAction = createServerAction(async () =>
  listArchivedSummaryProducts()
)

export const archiveSummaryProductAction = createServerAction(
  async (input: { productId: string; name: string }) =>
    archiveSummaryProduct(input)
)

export const unarchiveSummaryProductAction = createServerAction(
  async (productId: string) => unarchiveSummaryProduct(productId)
)

export const mergeArchivedSummaryProductsAction = createServerAction(
  async (
    items: Array<{ productId: string; name: string; archivedAt?: string }>
  ) => mergeArchivedSummaryProducts(items)
)
