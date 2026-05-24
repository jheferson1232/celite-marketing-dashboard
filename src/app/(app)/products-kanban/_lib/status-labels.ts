import type { ProductStatus } from "@/lib/products/status"

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  running: "Running",
  archived: "Archived",
}

export const PRODUCT_STATUS_DESCRIPTIONS: Record<ProductStatus, string> = {
  draft: "En preparación",
  ready: "Listo para lanzar",
  running: "En campaña activa",
  archived: "Fuera de rotación",
}
