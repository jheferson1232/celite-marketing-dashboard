import type { ProductStatus } from "@/lib/products/status"

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Borrador",
  ready: "Listo para lanzar",
  running: "En curso",
  archived: "Archivado",
}

export const PRODUCT_STATUS_BADGE_CLASS: Record<ProductStatus, string> = {
  draft:
    "border-violet-500/30 bg-violet-500/20 text-violet-800 dark:text-violet-200",
  ready:
    "border-amber-500/35 bg-amber-400/25 text-amber-950 dark:text-amber-100",
  running:
    "border-emerald-500/30 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200",
  archived: "border-border bg-muted text-muted-foreground",
}
