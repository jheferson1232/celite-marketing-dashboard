"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiAddLine, RiShoppingBag2Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import type { ProductRecord } from "@/lib/services/product"
import {
  createProductAction,
  listProductsAction,
} from "../../_actions/products"
import { ProductCard } from "./product-card"
import { ProductCreateForm } from "../product/product-create-form"

interface ProductsContentProps {
  basePath?: "/products" | "/producto"
}

export function ProductsContent({ basePath = "/products" }: ProductsContentProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)

  const { data: products = [], isLoading, isError, error } = useQuery({
    queryKey: ["products"],
    queryFn: () => runServerAction(listProductsAction()),
    staleTime: 30 * 1000,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  const createMutation = useMutation({
    mutationFn: async (values: { name: string; notes: string }) => {
      const created = await runServerAction(
        createProductAction({
          name: values.name,
          notes: values.notes || null,
        })
      )
      if (!created) throw new Error("No se pudo crear el producto")
      return created
    },
    onSuccess: (created: ProductRecord) => {
      invalidate()
      if (basePath === "/products") {
        router.push(`/products/${created.id}`)
      } else {
        router.push(`${basePath}/${created.id}`)
      }
    },
  })

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <RiShoppingBag2Line className="size-5" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Catálogo
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Gestiona el catálogo de productos. Crea uno nuevo y completa imágenes
            y videos en la página de edición.
          </p>
        </div>
        <Button type="button" onClick={() => setFormOpen(true)}>
          <RiAddLine className="size-4" />
          Nuevo producto
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/5] w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error?.message ?? "No se pudieron cargar los productos."}
        </p>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <RiShoppingBag2Line className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Aún no hay productos</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crea el primero con un nombre y añade imágenes o videos después.
          </p>
          <Button type="button" className="mt-4" onClick={() => setFormOpen(true)}>
            <RiAddLine className="size-4" />
            Crear producto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} basePath={basePath} />
          ))}
        </div>
      )}

      <ProductCreateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        isPending={createMutation.isPending}
        onSubmit={async (values) => {
          await createMutation.mutateAsync(values)
        }}
      />
    </div>
  )
}
