"use server"

import { createServerAction } from "@/lib/server-action"
import type { DateRange } from "@/lib/services/meta/types"
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductSalesHistory,
  listProducts,
  updateProduct,
  type CreateProductInput,
  type ProductRecord,
  type ProductSalesHistorySummary,
  type UpdateProductInput,
} from "@/lib/services/product"

export const listProductsAction = createServerAction(
  async (): Promise<ProductRecord[]> => listProducts()
)

export const getProductByIdAction = createServerAction(
  async (id: string): Promise<ProductRecord | null> => getProductById(id)
)

export const createProductAction = createServerAction(
  async (input: CreateProductInput): Promise<ProductRecord> => createProduct(input)
)

export const updateProductAction = createServerAction(
  async (input: UpdateProductInput): Promise<ProductRecord> => updateProduct(input)
)

export const deleteProductAction = createServerAction(
  async (id: string): Promise<void> => deleteProduct(id)
)

export const getProductSalesHistoryAction = createServerAction(
  async (input: {
    productId: string
    dateRange: DateRange
  }): Promise<ProductSalesHistorySummary> =>
    getProductSalesHistory(input.productId, input.dateRange)
)
