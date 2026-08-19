"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiArrowLeftLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import {
  deleteProductAction,
  getProductByIdAction,
  updateProductAction,
} from "../../_actions/products"
import { useProductoDateRange } from "../../_lib/use-producto-date-range"
import { useProductoPlatformFilter } from "../../_lib/use-producto-platform-filter"
import { useProductoLinkedCampaigns } from "../../_lib/use-producto-linked-campaigns"
import { ProductoForm } from "../product/producto-form"
import { ProductoDetailHeader } from "./producto-detail-header"
import { ProductoDetailOverview } from "./producto-detail-overview"
import { ProductoLinkedCampaignsTable } from "./producto-linked-campaigns-table"

interface ProductoDetailContentProps {
  productId: string
}

export function ProductoDetailContent({ productId }: ProductoDetailContentProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { dateRange, setDateRange } = useProductoDateRange()
  const { platformFilter, setPlatformFilter } = useProductoPlatformFilter()
  const [formOpen, setFormOpen] = useState(false)

  const {
    data: product,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      const result = await runServerAction(getProductByIdAction(productId))
      if (!result) throw new Error("Producto no encontrado")
      return result
    },
    staleTime: 30 * 1000,
  })

  const {
    tiktokCampaigns,
    metaCampaigns,
    isLoadingCampaigns,
    tiktokCampaignsError,
    extendedMetricsLoading,
    extendedMetricsError,
  } = useProductoLinkedCampaigns(product?.campaigns ?? [])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["products"] })
    void queryClient.invalidateQueries({ queryKey: ["product", productId] })
  }

  const updateMutation = useMutation({
    mutationFn: async (values: {
      id: string
      name: string
      imageUrl: string
      notes: string
    }) => {
      const updated = await runServerAction(
        updateProductAction({
          id: values.id,
          name: values.name,
          coverImageUrl: values.imageUrl || null,
          notes: values.notes || null,
        })
      )
      if (!updated) throw new Error("No se pudo actualizar el producto")
      return updated
    },
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runServerAction(deleteProductAction(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      router.push("/products")
    },
  })

  const handleDelete = () => {
    if (!product) return
    if (!window.confirm(`¿Eliminar "${product.name}"?`)) return
    deleteMutation.mutate(product.id)
  }

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="size-28 shrink-0 rounded-xl sm:size-32" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-md" />
              ))}
            </div>
          </div>
          <Skeleton className="h-[180px] rounded-lg" />
          <Skeleton className="h-[150px] rounded-lg" />
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="flex w-full flex-col gap-4 p-6 lg:p-8">
        <Button type="button" variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/products">
            <RiArrowLeftLine className="size-4" />
            Volver al catálogo
          </Link>
        </Button>
        <p className="text-sm text-destructive">
          {error?.message ?? "Producto no encontrado."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-8 p-6 lg:p-8">
      <ProductoDetailHeader
        from={dateRange.from}
        to={dateRange.to}
        onRangeChange={setDateRange}
        platformFilter={platformFilter}
        onPlatformFilterChange={setPlatformFilter}
      />

      <ProductoDetailOverview
        product={product}
        onEdit={() => setFormOpen(true)}
        onDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
      />

      <section className="min-w-0">
        <ProductoLinkedCampaignsTable
          campaignCount={product.campaigns.length}
          tiktokCampaigns={tiktokCampaigns}
          metaCampaigns={metaCampaigns}
          isLoading={isLoadingCampaigns}
          tiktokCampaignsError={tiktokCampaignsError}
          extendedMetricsLoading={extendedMetricsLoading}
          extendedMetricsError={extendedMetricsError}
        />
      </section>

      <ProductoForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={product}
        isPending={updateMutation.isPending}
        onSubmit={async (values) => {
          await updateMutation.mutateAsync({
            id: product.id,
            ...values,
          })
        }}
      />
    </div>
  )
}
