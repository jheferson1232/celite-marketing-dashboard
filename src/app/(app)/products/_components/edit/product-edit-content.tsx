"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiArrowLeftLine,
  RiBarChartGroupedLine,
  RiDeleteBinLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import type { ProductVariantRecord } from "@/lib/services/product"
import {
  attachVariantCreativeAction,
  detachVariantCreativeAction,
  updateProductVariantAction,
} from "../../_actions/variants"
import {
  createProductVariantAction,
  deleteProductAction,
  getProductByIdAction,
} from "../../_actions/products"
import type { ProductVariantCreateValues } from "./product-variant-create-dialog"
import {
  ProductVariantEditDialog,
  type ProductVariantEditValues,
} from "./product-variant-edit-dialog"
import { useProductEditSave } from "../../_lib/use-product-edit-save"
import { ProductVariantsPanel } from "./product-variants-panel"
import { ProductDeleteDialog } from "../product/product-delete-dialog"

interface ProductEditContentProps {
  productId: string
}

export function ProductEditContent({ productId }: ProductEditContentProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editVariantId, setEditVariantId] = useState<string | null>(null)

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
    formError,
    saveNotice,
    busy,
    saveLabel,
    save,
    invalidateProduct,
  } = useProductEditSave(product)

  const editVariant = useMemo(
    () => product?.variants.find((variant) => variant.id === editVariantId) ?? null,
    [product?.variants, editVariantId]
  )

  const invalidate = () => {
    invalidateProduct(productId)
    void queryClient.invalidateQueries({ queryKey: ["creatives"] })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runServerAction(deleteProductAction(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] })
      router.push("/products")
    },
  })

  const createVariantMutation = useMutation({
    mutationFn: async (values: ProductVariantCreateValues) => {
      const updated = await runServerAction(
        createProductVariantAction({
          productId,
          name: values.name,
        })
      )
      if (!updated) throw new Error("No se pudo crear la variante")
      return updated
    },
    onSuccess: invalidate,
  })

  const updateVariantMutation = useMutation({
    mutationFn: async (input: { id: string } & ProductVariantEditValues) => {
      const updated = await runServerAction(
        updateProductVariantAction({
          id: input.id,
          name: input.name,
        })
      )
      if (!updated) throw new Error("No se pudo actualizar la variante")
      return updated
    },
    onSuccess: invalidate,
  })

  const attachVariantCreativeMutation = useMutation({
    mutationFn: async (input: { variantId: string; creativeIds: string[] }) => {
      for (const creativeId of input.creativeIds) {
        const updated = await runServerAction(
          attachVariantCreativeAction({
            variantId: input.variantId,
            creativeId,
          })
        )
        if (!updated) throw new Error("No se pudo vincular el creative")
      }
    },
    onSuccess: invalidate,
  })

  const detachVariantCreativeMutation = useMutation({
    mutationFn: async (input: { variantId: string; creativeId: string }) => {
      const updated = await runServerAction(
        detachVariantCreativeAction(input)
      )
      if (!updated) throw new Error("No se pudo desvincular el creative")
      return updated
    },
    onSuccess: invalidate,
  })

  const createVariant = async (
    values: ProductVariantCreateValues
  ): Promise<string | null> => {
    try {
      await createVariantMutation.mutateAsync(values)
      return null
    } catch (createError) {
      return createError instanceof Error
        ? createError.message
        : "No se pudo crear la variante"
    }
  }

  const saveVariant = async (
    values: ProductVariantEditValues
  ): Promise<string | null> => {
    if (!editVariant) return "Variante no encontrada"
    try {
      await updateVariantMutation.mutateAsync({
        id: editVariant.id,
        ...values,
      })
      return null
    } catch (saveError) {
      return saveError instanceof Error
        ? saveError.message
        : "No se pudo guardar la variante"
    }
  }

  const attachVariantCreatives = async (
    creativeIds: string[]
  ): Promise<string | null> => {
    if (!editVariant) return "Variante no encontrada"
    try {
      await attachVariantCreativeMutation.mutateAsync({
        variantId: editVariant.id,
        creativeIds,
      })
      return null
    } catch (attachError) {
      return attachError instanceof Error
        ? attachError.message
        : "No se pudieron vincular los creativos"
    }
  }

  const detachVariantCreative = async (creativeId: string) => {
    if (!editVariant) return
    await detachVariantCreativeMutation.mutateAsync({
      variantId: editVariant.id,
      creativeId,
    })
  }

  if (isLoading) {
    return (
      <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-xl" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="flex w-full flex-col gap-4 p-6 lg:p-8">
        <Button type="button" variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/products">
            <RiArrowLeftLine className="size-4" />
            Volver a Products
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button type="button" variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/products">
            <RiArrowLeftLine className="size-4" />
            Volver a Products
          </Link>
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild className="gap-2">
            <Link href={`/product-stats/${productId}`}>
              <RiBarChartGroupedLine className="size-4" />
              Estadísticas
            </Link>
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={busy || !name.trim()}
          >
            {saveLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={busy || deleteMutation.isPending}
          >
            <RiDeleteBinLine className="size-4" />
            Eliminar producto
          </Button>
        </div>
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
      {saveNotice && !formError ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{saveNotice}</p>
      ) : null}

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
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

        <ProductVariantsPanel
          variants={product.variants}
          onCreate={createVariant}
          onSelectVariant={(variant: ProductVariantRecord) =>
            setEditVariantId(variant.id)
          }
          disabled={busy || deleteMutation.isPending}
          creating={createVariantMutation.isPending}
        />
      </div>

      <ProductVariantEditDialog
        open={editVariantId !== null}
        onOpenChange={(open) => {
          if (!open) setEditVariantId(null)
        }}
        variant={editVariant}
        onSave={saveVariant}
        onAttachCreatives={attachVariantCreatives}
        onDetachCreative={detachVariantCreative}
        saving={updateVariantMutation.isPending}
        linking={attachVariantCreativeMutation.isPending}
      />

      <ProductDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        productName={product.name}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(product.id)}
      />
    </div>
  )
}
