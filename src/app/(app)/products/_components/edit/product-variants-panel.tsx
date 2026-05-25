"use client"

import Image from "next/image"
import { useState } from "react"
import {
  RiAddLine,
  RiImageLine,
  RiPaletteLine,
} from "@remixicon/react"
import { cn } from "@/lib/utils"
import type { ProductVariantRecord } from "@/lib/services/product"
import {
  ProductVariantCreateDialog,
  type ProductVariantCreateValues,
} from "./product-variant-create-dialog"

interface ProductVariantsPanelProps {
  variants: ProductVariantRecord[]
  onCreate: (values: ProductVariantCreateValues) => Promise<string | null>
  onSelectVariant: (variant: ProductVariantRecord) => void
  disabled?: boolean
  creating?: boolean
}

function getVariantPreviewImage(variant: ProductVariantRecord): string | null {
  const imageCreative = variant.creatives.find((creative) => creative.type === "image")
  return imageCreative?.url ?? null
}

function creativesCountLabel(count: number): string {
  if (count === 0) return "Sin creativos"
  if (count === 1) return "1 creativo"
  return `${count} creativos`
}

function VariantThumbnail({
  variant,
  displayName,
}: {
  variant: ProductVariantRecord
  displayName: string
}) {
  const previewUrl = getVariantPreviewImage(variant)

  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted sm:size-[4.5rem]">
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt={displayName}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-muted/80 text-muted-foreground">
          <RiImageLine className="size-6 opacity-40 sm:size-7" />
          <RiPaletteLine className="size-4 opacity-30 sm:size-5" />
        </div>
      )}
    </div>
  )
}

function VariantCard({
  variant,
  disabled,
  onSelect,
}: {
  variant: ProductVariantRecord
  disabled?: boolean
  onSelect: () => void
}) {
  const displayName = variant.name.trim() || "Sin nombre"

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-4 rounded-lg border bg-card p-3 text-left shadow-sm transition sm:p-4",
        "hover:border-primary/40 hover:bg-muted/20",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <VariantThumbnail variant={variant} displayName={displayName} />

      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="truncate text-sm font-semibold leading-snug">{displayName}</h3>
        <p className="text-xs text-muted-foreground">
          {creativesCountLabel(variant.creatives.length)}
        </p>
      </div>
    </button>
  )
}

export function ProductVariantsPanel({
  variants,
  onCreate,
  onSelectVariant,
  disabled = false,
  creating = false,
}: ProductVariantsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const panelDisabled = disabled || creating

  return (
    <>
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Variantes</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada variante con su nombre y creativos del Baúl.
            </p>
          </div>
          <button
            type="button"
            disabled={panelDisabled}
            onClick={() => setDialogOpen(true)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
              "hover:border-primary/50 hover:bg-muted/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              panelDisabled && "cursor-not-allowed opacity-50"
            )}
          >
            <RiAddLine className="size-4" />
            Añadir variante
          </button>
        </div>

        {variants.length === 0 ? (
          <div className="flex flex-col items-center justify-center border-y border-dashed py-8 text-center">
            <RiPaletteLine className="mb-3 size-10 text-muted-foreground/50" />
            <p className="text-sm font-medium">Sin variantes</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Este producto aún no tiene variantes registradas.
            </p>
            <button
              type="button"
              disabled={panelDisabled}
              onClick={() => setDialogOpen(true)}
              className={cn(
                "mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
                "hover:border-primary/50 hover:bg-muted/40",
                panelDisabled && "cursor-not-allowed opacity-50"
              )}
            >
              <RiAddLine className="size-4" />
              Añadir variante
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {variants.map((variant) => (
              <VariantCard
                key={variant.id}
                variant={variant}
                disabled={panelDisabled}
                onSelect={() => onSelectVariant(variant)}
              />
            ))}
          </div>
        )}
      </section>

      <ProductVariantCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={onCreate}
        isPending={creating}
      />
    </>
  )
}
