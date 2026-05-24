"use client"

import { useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import type { ProductRecord } from "@/lib/services/product"
import type { ProductStatus } from "@/lib/products/status"
import {
  PRODUCT_STATUS_DESCRIPTIONS,
  PRODUCT_STATUS_LABELS,
} from "../_lib/status-labels"
import { ProductsKanbanCard } from "./products-kanban-card"

interface ProductsKanbanColumnProps {
  status: ProductStatus
  products: ProductRecord[]
  activeProductId: string | null
  isOver: boolean
  onProductLaunched?: () => void
}

export function ProductsKanbanColumn({
  status,
  products,
  activeProductId,
  isOver,
  onProductLaunched,
}: ProductsKanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: status,
    data: { status },
  })

  const highlight = isOver || isDroppableOver

  return (
    <section
      ref={setNodeRef}
      aria-label={`Columna ${PRODUCT_STATUS_LABELS[status]}`}
      className={cn(
        "flex min-h-[420px] min-w-[260px] flex-1 flex-col rounded-xl border bg-muted/20",
        highlight && "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
      )}
    >
      <header className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{PRODUCT_STATUS_LABELS[status]}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {products.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {PRODUCT_STATUS_DESCRIPTIONS[status]}
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-3 p-3">
        {products.length === 0 ? (
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground",
              highlight && "border-primary/40 text-primary"
            )}
          >
            Suelta productos aquí
          </div>
        ) : (
          products.map((product) => (
            <ProductsKanbanCard
              key={product.id}
              product={product}
              isDragging={activeProductId === product.id}
              onLaunched={onProductLaunched}
            />
          ))
        )}
      </div>
    </section>
  )
}
