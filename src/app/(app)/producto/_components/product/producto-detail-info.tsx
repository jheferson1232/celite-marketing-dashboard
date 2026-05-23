"use client"

import Image from "next/image"
import { useState } from "react"
import {
  RiDeleteBinLine,
  RiImageLine,
  RiMegaphoneLine,
  RiPencilLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import type { ProductRecord } from "@/lib/services/product"
import { ProductoCampanasDialog } from "../campaigns/producto-campanas-dialog"

interface ProductoDetailInfoProps {
  product: ProductRecord
  onEdit: () => void
  onDelete: () => void
  isDeleting?: boolean
}

export function ProductoDetailInfo({
  product,
  onEdit,
  onDelete,
  isDeleting = false,
}: ProductoDetailInfoProps) {
  const [campanasOpen, setCampanasOpen] = useState(false)
  const campaignLabel =
    product.campaigns.length === 1
      ? "1 campaña vinculada"
      : `${product.campaigns.length} campañas vinculadas`

  return (
    <section className="flex gap-4 sm:items-start">
      <div className="relative size-28 shrink-0 overflow-hidden rounded-xl border bg-muted sm:size-32">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <RiImageLine className="size-8 opacity-40 sm:size-10" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Producto
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {product.name}
          </h1>
          {product.notes ? (
            <p className="mt-1 text-sm text-muted-foreground">{product.notes}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">{campaignLabel}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <RiPencilLine className="size-4" />
            Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCampanasOpen(true)}
          >
            <RiMegaphoneLine className="size-4" />
            Campañas
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <RiDeleteBinLine className="size-4" />
            Eliminar
          </Button>
        </div>
      </div>

      <ProductoCampanasDialog
        product={product}
        open={campanasOpen}
        onOpenChange={setCampanasOpen}
      />
    </section>
  )
}
