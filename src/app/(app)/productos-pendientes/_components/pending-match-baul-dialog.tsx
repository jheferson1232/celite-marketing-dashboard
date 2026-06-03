"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  RiArchiveLine,
  RiCheckLine,
  RiLinkM,
  RiLoader4Line,
  RiStarFill,
} from "@remixicon/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import type { PendingProductMatchRecord } from "@/lib/services/product-pending/types"
import { parseMatchDisplay } from "@/lib/services/product-pending/parse-match-display"
import { listProductsAction } from "@/app/(app)/products/_actions/products"
import type { VariantOption } from "@/app/(app)/baul/_components/creative-variant-associate"

interface PendingMatchBaulDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: PendingProductMatchRecord | null
  disabled?: boolean
  onConfirm: (variantIds: string[]) => Promise<void>
}

export function PendingMatchBaulDialog({
  open,
  onOpenChange,
  match,
  disabled = false,
  onConfirm,
}: PendingMatchBaulDialogProps) {
  const [search, setSearch] = useState("")
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(
    () => new Set()
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const {
    data: products = [],
    isLoading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: ["products"],
    queryFn: () => runServerAction(listProductsAction()),
    staleTime: 30 * 1000,
    enabled: open,
  })

  const variants = useMemo<VariantOption[]>(() => {
    const rows: VariantOption[] = []
    for (const product of products) {
      for (const variant of product.variants) {
        rows.push({
          id: variant.id,
          name: variant.name,
          productName: product.name,
        })
      }
    }
    return rows.sort((a, b) =>
      `${a.productName} ${a.name}`.localeCompare(`${b.productName} ${b.name}`, "es")
    )
  }, [products])

  const filteredVariants = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return variants
    return variants.filter(
      (variant) =>
        variant.name.toLowerCase().includes(query) ||
        variant.productName.toLowerCase().includes(query)
    )
  }, [variants, search])

  const matchInfo = useMemo(
    () => (match ? parseMatchDisplay(match) : null),
    [match]
  )

  useEffect(() => {
    if (!open) return
    setSearch("")
    setSelectedVariantIds(new Set())
    setError(null)
    setSaving(false)
  }, [open, match?.id])

  const toggleVariant = (variantId: string) => {
    setSelectedVariantIds((current) => {
      const next = new Set(current)
      if (next.has(variantId)) next.delete(variantId)
      else next.add(variantId)
      return next
    })
  }

  const handleConfirm = async () => {
    if (selectedVariantIds.size === 0 || saving || disabled) return

    setSaving(true)
    setError(null)

    try {
      await onConfirm([...selectedVariantIds])
      onOpenChange(false)
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "No se pudo añadir al baúl."
      )
    } finally {
      setSaving(false)
    }
  }

  const previewLabel =
    matchInfo?.pageName ??
    matchInfo?.authorHandle ??
    match?.title ??
    "Video de TikTok"

  return (
    <Dialog open={open} onOpenChange={disabled || saving ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <RiStarFill className="size-5 text-amber-500" />
            Añadir al baúl
          </DialogTitle>
          <DialogDescription>
            Elige una o más variantes para vincular{" "}
            <span className="text-foreground font-medium">{previewLabel}</span>. El
            video se guardará en el baúl y quedará marcado como favorito.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {match && !matchInfo?.videoUrl ? (
            <p className="text-sm text-destructive">
              Este video no tiene archivo reproducible. Vuelve a buscar videos en
              SociaVault.
            </p>
          ) : null}

          <div className="relative mb-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar variante o producto…"
              disabled={disabled || saving || isLoading}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {queryError instanceof Error
                ? queryError.message
                : "No se pudo cargar el catálogo de productos."}
            </p>
          ) : variants.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed py-10 text-center">
              <RiArchiveLine className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">No hay variantes en el catálogo</p>
              <p className="mt-1 max-w-sm px-4 text-sm text-muted-foreground">
                Crea un producto y al menos una variante en{" "}
                <Link href="/products" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Productos
                </Link>{" "}
                antes de vincular creatives.
              </p>
            </div>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
              {filteredVariants.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Ninguna variante coincide con la búsqueda.
                </li>
              ) : (
                filteredVariants.map((variant) => {
                  const selected = selectedVariantIds.has(variant.id)
                  return (
                    <li key={variant.id}>
                      <button
                        type="button"
                        disabled={disabled || saving || !matchInfo?.videoUrl}
                        onClick={() => toggleVariant(variant.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition",
                          "hover:bg-muted/70",
                          selected && "bg-primary/5"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {variant.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {variant.productName}
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          {selected ? (
                            <>
                              <RiCheckLine className="size-3.5 text-primary" />
                              Seleccionada
                            </>
                          ) : (
                            <>
                              <RiLinkM className="size-3.5" />
                              Seleccionar
                            </>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          )}

          {variants.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedVariantIds.size} variante
              {selectedVariantIds.size === 1 ? "" : "s"} seleccionada
              {selectedVariantIds.size === 1 ? "" : "s"}.
            </p>
          ) : null}

          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabled || saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={
              disabled ||
              saving ||
              selectedVariantIds.size === 0 ||
              !matchInfo?.videoUrl ||
              variants.length === 0
            }
          >
            {saving ? (
              <>
                <RiLoader4Line className="size-4 animate-spin" />
                Guardando…
              </>
            ) : selectedVariantIds.size > 0 ? (
              `Añadir al baúl (${selectedVariantIds.size})`
            ) : (
              "Añadir al baúl"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
