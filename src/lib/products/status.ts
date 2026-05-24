export const PRODUCT_STATUS_VALUES = [
  "draft",
  "ready",
  "running",
  "archived",
] as const

export type ProductStatus = (typeof PRODUCT_STATUS_VALUES)[number]

export function isProductStatus(value: string): value is ProductStatus {
  return (PRODUCT_STATUS_VALUES as readonly string[]).includes(value)
}
