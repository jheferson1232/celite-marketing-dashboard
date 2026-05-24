"use server"

import { createServerAction } from "@/lib/server-action"
import type { DateRange } from "@/lib/services/meta/types"
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductSalesHistory,
  listProducts,
  saveProductEdit,
  updateProduct,
  updateProductStatus,
  type CreateProductInput,
  type ProductRecord,
  type ProductSalesHistorySummary,
  type SaveProductEditResult,
  type UpdateProductInput,
} from "@/lib/services/product"
import type { ProductStatus } from "@/lib/products/status"

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

export const saveProductEditAction = createServerAction(
  async (input: UpdateProductInput): Promise<SaveProductEditResult> =>
    saveProductEdit(input)
)

export const updateProductStatusAction = createServerAction(
  async (input: {
    productId: string
    status: ProductStatus
  }): Promise<ProductRecord> =>
    updateProductStatus(input.productId, input.status)
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
