"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiArrowLeftLine,
  RiDeleteBinLine,
  RiRocketLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import type { ProductLandingPageRecord } from "@/lib/services/product"
import {
  deleteProductAction,
  getProductByIdAction,
} from "../../_actions/products"
import { useProductMediaSave } from "../../_lib/use-product-media-save"
import { LandingPagesPanel } from "./landing-pages-panel"
import { ProductTikTokLaunchDialog } from "../launch/product-tiktok-launch-dialog"
import { ProductDeleteDialog } from "../product/product-delete-dialog"
import { ProductMediaPicker } from "../product/product-media-picker"

interface ProductEditContentProps {
  productId: string
}

export function ProductEditContent({ productId }: ProductEditContentProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [launchOpen, setLaunchOpen] = useState(false)

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
    name,
    setName,
    landingPages,
    setLandingPages,
    budget,
    setBudget,
    existingImages,
    setExistingImages,
    existingVideos,
    setExistingVideos,
    localItems,
    setLocalItems,
    formError,
    saveNotice,
    busy,
    saveLabel,
    save,
  } = useProductMediaSave(product)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runServerAction(deleteProductAction(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      router.push("/products-kanban")
    },
  })

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const activeLandingPages = landingPages

  const addLandingPage = (page: ProductLandingPageRecord) => {
    if (activeLandingPages.some((entry) => entry.id === page.id)) return
    setLandingPages([...activeLandingPages, page])
  }

  const removeLandingPage = (landingPageId: string) => {
    setLandingPages(activeLandingPages.filter((page) => page.id !== landingPageId))
  }

  const handleLandingPageCreated = (page: ProductLandingPageRecord) => {
    addLandingPage(page)
  }

  const handleLandingPageUpdated = (page: ProductLandingPageRecord) => {
    setLandingPages((current) =>
      current.map((entry) => (entry.id === page.id ? page : entry))
    )
  }

  const handleLandingPageDeleted = (landingPageId: string) => {
    removeLandingPage(landingPageId)
  }

  if (isError || !product) {
    return (
      <div className="flex w-full flex-col gap-4 p-6 lg:p-8">
        <Button type="button" variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/products-kanban">
            <RiArrowLeftLine className="size-4" />
            Volver al Kanban
          </Link>
        </Button>
        <p className="text-sm text-destructive">
          {error?.message ?? "Producto no encontrado."}
        </p>
      </div>
    )
  }

  const isReady = product.status === "ready"
  const canLaunch = product.status === "ready" || product.status === "draft"
  const needsVideoUpload = product.videos.length === 0
  const showSave =
    !isReady || needsVideoUpload || localItems.length > 0

  return (
    <div className="flex w-full min-w-0 flex-col gap-8 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button type="button" variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/products-kanban">
              <RiArrowLeftLine className="size-4" />
              Volver al Kanban
            </Link>
          </Button>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Edición
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Editar producto</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isReady
                ? needsVideoUpload
                  ? "Sube videos y pulsa Guardar (Vercel Blob). Luego lanza en TikTok."
                  : "Listo para lanzar en TikTok. Guardar solo si cambias videos o datos."
                : "Al guardar, si está en Draft y cumple las comprobaciones del lanzamiento, pasa a Ready."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {showSave ? (
            <Button
              type="button"
              onClick={() => void save()}
              disabled={busy || !name.trim()}
            >
              {isReady && needsVideoUpload ? "Guardar videos" : saveLabel}
            </Button>
          ) : null}
          {canLaunch ? (
            <Button
              type="button"
              variant={isReady ? "default" : "secondary"}
              className="gap-2"
              onClick={() => setLaunchOpen(true)}
              disabled={busy}
            >
              <RiRocketLine className="size-4" />
              Lanzar en TikTok
            </Button>
          ) : null}
        </div>
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      {saveNotice && !formError ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{saveNotice}</p>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Detalles</h2>
            <div className="space-y-2">
              <label htmlFor="edit-product-name" className="text-sm font-medium">
                Nombre
              </label>
              <Input
                id="edit-product-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Pantalón wide leg"
                required
                disabled={busy}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Operación</h2>
            <div className="space-y-2">
              <label htmlFor="edit-product-budget" className="text-sm font-medium">
                Presupuesto (PEN)
              </label>
              <Input
                id="edit-product-budget"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="Ej. 30"
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Presupuesto diario planificado en soles (PEN) para campañas TikTok
                de este producto.
              </p>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-sm font-semibold">Videos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Clips promocionales o demostraciones del producto.
              </p>
            </div>
            <ProductMediaPicker
              mode="videos"
              existingImages={existingImages}
              existingVideos={existingVideos}
              localItems={localItems}
              onLocalItemsChange={setLocalItems}
              onExistingImagesChange={setExistingImages}
              onExistingVideosChange={setExistingVideos}
              disabled={busy}
            />
          </section>
        </div>

        <LandingPagesPanel
          productLandingPages={activeLandingPages}
          onAddToProduct={addLandingPage}
          onRemoveFromProduct={removeLandingPage}
          onLandingPageCreated={handleLandingPageCreated}
          onLandingPageUpdated={handleLandingPageUpdated}
          onLandingPageDeleted={handleLandingPageDeleted}
          disabled={busy}
        />
      </div>

      <div className="border-t pt-6">
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={busy || deleteMutation.isPending}
        >
          <RiDeleteBinLine className="size-4" />
          Eliminar producto
        </Button>
      </div>

      <ProductDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        productName={product.name}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(product.id)}
      />

      <ProductTikTokLaunchDialog
        product={product}
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        onLaunched={() => {
          void queryClient.invalidateQueries({ queryKey: ["product", productId] })
          void queryClient.invalidateQueries({ queryKey: ["products"] })
          router.push("/products-kanban")
        }}
      />
    </div>
  )
}
