"use client"

import { useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiAlertLine, RiLayoutColumnLine } from "@remixicon/react"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import { PRODUCT_STATUS_VALUES } from "@/lib/products/status"
import type { ProductStatus } from "@/lib/products/status"
import type { ProductRecord } from "@/lib/services/product"
import {
  listProductsAction,
  updateProductStatusAction,
} from "@/app/(app)/products/_actions/products"
import { ProductsKanbanColumn } from "./products-kanban-column"
import { ProductsKanbanCard } from "./products-kanban-card"

function groupProductsByStatus(products: ProductRecord[]) {
  const grouped = Object.fromEntries(
    PRODUCT_STATUS_VALUES.map((status) => [status, [] as ProductRecord[]])
  ) as Record<ProductStatus, ProductRecord[]>

  for (const product of products) {
    grouped[product.status].push(product)
  }

  return grouped
}

function resolveTargetStatus(
  over: DragEndEvent["over"] | DragOverEvent["over"]
): ProductStatus | null {
  if (!over) return null

  const overData = over.data.current
  if (
    overData?.status &&
    (PRODUCT_STATUS_VALUES as readonly string[]).includes(String(overData.status))
  ) {
    return overData.status as ProductStatus
  }

  const overProduct = overData?.product as ProductRecord | undefined
  if (overProduct?.status) return overProduct.status

  const overId = String(over.id)
  if ((PRODUCT_STATUS_VALUES as readonly string[]).includes(overId)) {
    return overId as ProductStatus
  }

  return null
}

export function ProductsKanbanContent() {
  const queryClient = useQueryClient()
  const [activeProduct, setActiveProduct] = useState<ProductRecord | null>(null)
  const [overStatus, setOverStatus] = useState<ProductStatus | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  const { data: products = [], isLoading, isError, error } = useQuery({
    queryKey: ["products"],
    queryFn: () => runServerAction(listProductsAction()),
    staleTime: 30 * 1000,
  })

  const productsByStatus = useMemo(
    () => groupProductsByStatus(products),
    [products]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const statusMutation = useMutation({
    mutationFn: async (input: { productId: string; status: ProductStatus }) => {
      const updated = await runServerAction(updateProductStatusAction(input))
      if (!updated) throw new Error("No se pudo actualizar el estado")
      return updated
    },
    onMutate: async ({ productId, status }) => {
      setMoveError(null)
      await queryClient.cancelQueries({ queryKey: ["products"] })
      const previous = queryClient.getQueryData<ProductRecord[]>(["products"])
      queryClient.setQueryData<ProductRecord[]>(["products"], (current) =>
        current?.map((product) =>
          product.id === productId ? { ...product, status } : product
        ) ?? []
      )
      return { previous }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["products"], context.previous)
      }
      setMoveError("No se pudo mover el producto. Se revirtió el cambio.")
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
    },
  })

  const handleDragStart = (event: DragStartEvent) => {
    const product = event.active.data.current?.product as ProductRecord | undefined
    setActiveProduct(product ?? null)
    setMoveError(null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverStatus(resolveTargetStatus(event.over))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveProduct(null)
    setOverStatus(null)

    const product = event.active.data.current?.product as ProductRecord | undefined
    const nextStatus = resolveTargetStatus(event.over)

    if (!product || !nextStatus || product.status === nextStatus) return

    statusMutation.mutate({
      productId: product.id,
      status: nextStatus,
    })
  }

  const handleDragCancel = () => {
    setActiveProduct(null)
    setOverStatus(null)
  }

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div>
        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
          <RiLayoutColumnLine className="size-5" />
          <span className="text-xs font-medium uppercase tracking-wide">
            Flujo de productos
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Products Kanban</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Arrastra productos entre columnas para cambiar su estado. Usa el enlace
          en cada tarjeta para editar detalles.
        </p>
      </div>

      {moveError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <RiAlertLine className="mt-0.5 size-4 shrink-0" />
          <span>{moveError}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {PRODUCT_STATUS_VALUES.map((status) => (
            <Skeleton key={status} className="h-[420px] min-w-[260px] flex-1 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Error al cargar productos"}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex gap-4 overflow-x-auto pb-2">
            {PRODUCT_STATUS_VALUES.map((status) => (
              <ProductsKanbanColumn
                key={status}
                status={status}
                products={productsByStatus[status]}
                activeProductId={activeProduct?.id ?? null}
                isOver={overStatus === status}
                onProductLaunched={() => {
                  void queryClient.invalidateQueries({ queryKey: ["products"] })
                }}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeProduct ? (
              <div className="w-[260px] rotate-2 opacity-95">
                <ProductsKanbanCard product={activeProduct} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
