"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import {
  RiAddLine,
  RiCloseLine,
  RiImageLine,
  RiLoader4Line,
  RiPlayCircleLine,
  RiVideoLine,
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
import { cn } from "@/lib/utils"
import type { ProductVariantRecord } from "@/lib/services/product"
import { VariantCreativePickerDialog } from "./variant-creative-picker-dialog"

export type ProductVariantEditValues = {
  name: string
}

interface ProductVariantEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: ProductVariantRecord | null
  onSave: (values: ProductVariantEditValues) => Promise<string | null>
  onAttachCreatives: (creativeIds: string[]) => Promise<string | null>
  onDetachCreative: (creativeId: string) => Promise<void>
  saving?: boolean
  linking?: boolean
}

function creativeLabel(name: string | null, url: string): string {
  return name?.trim() || url.split("/").pop() || "Creative"
}

function LinkedCreativeThumb({
  creative,
  disabled,
  onRemove,
}: {
  creative: ProductVariantRecord["creatives"][number]
  disabled?: boolean
  onRemove: () => void
}) {
  const label = creativeLabel(creative.name, creative.url)

  return (
    <div className="group relative min-w-0 w-full overflow-hidden rounded-lg border bg-muted shadow-sm">
      <div className="relative aspect-square">
        {creative.type === "image" ? (
          <Image
            src={creative.url}
            alt={label}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <>
            <video
              src={creative.url}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <RiPlayCircleLine className="size-8 text-white drop-shadow" />
            </div>
          </>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
          {creative.type === "image" ? (
            <RiImageLine className="size-3" />
          ) : (
            <RiVideoLine className="size-3" />
          )}
          {creative.type}
        </span>
      </div>
      <p className="truncate px-2 py-1.5 text-xs font-medium">{label}</p>
      <button
        type="button"
        aria-label={`Quitar ${label}`}
        disabled={disabled}
        onClick={onRemove}
        className={cn(
          "absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          disabled && "cursor-not-allowed opacity-40"
        )}
      >
        <RiCloseLine className="size-3.5" />
      </button>
    </div>
  )
}

export function ProductVariantEditDialog({
  open,
  onOpenChange,
  variant,
  onSave,
  onAttachCreatives,
  onDetachCreative,
  saving = false,
  linking = false,
}: ProductVariantEditDialogProps) {
  const [name, setName] = useState("")
  const [creatives, setCreatives] = useState<ProductVariantRecord["creatives"]>([])
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!open || !variant) return
    setName(variant.name)
    setError(null)
  }, [open, variant?.id, variant?.name])

  useEffect(() => {
    if (!variant) return
    setCreatives(variant.creatives)
  }, [variant?.creatives, variant?.id])

  const busy = saving || linking
  const assignedIds = useMemo(
    () => new Set(creatives.map((creative) => creative.id)),
    [creatives]
  )

  const handleSave = async () => {
    if (!variant || busy) return

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("El nombre es obligatorio.")
      return
    }

    setError(null)
    const saveError = await onSave({
      name: trimmedName,
    })
    if (saveError) {
      setError(saveError)
      return
    }
    onOpenChange(false)
  }

  const handleAttach = async (creativeIds: string[]) => {
    const attachError = await onAttachCreatives(creativeIds)
    if (!attachError && variant) {
      // Parent invalidates query; optimistically we could refetch via closing picker only
    }
    return attachError
  }

  if (!variant) return null

  return (
    <>
      <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
        <DialogContent className="flex max-h-[min(92vh,860px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Editar variante</DialogTitle>
            <DialogDescription>
              Actualiza los datos de la variante y vincula creativos del Baúl.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <label htmlFor="edit-variant-name" className="text-sm font-medium">
                  Nombre
                </label>
                <Input
                  id="edit-variant-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Creativos</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Imágenes y videos vinculados a esta variante.
                    </p>
                    {linking ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <RiLoader4Line className="size-3.5 animate-spin" />
                        Vinculando creativos…
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPickerOpen(true)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition",
                      "hover:border-primary/50 hover:bg-muted/40",
                      busy && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <RiAddLine className="size-4" />
                    Añadir creativos
                  </button>
                </div>

                {creatives.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
                    <RiImageLine className="mb-3 size-10 text-muted-foreground/50" />
                    <p className="text-sm font-medium">Sin creativos</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Vincula imágenes o videos del Baúl a esta variante.
                    </p>
                  </div>
                ) : (
                  <div className="grid min-w-0 grid-cols-4 gap-2">
                    {creatives.map((creative) => (
                      <div key={creative.id} className="min-w-0 max-w-[400px]">
                        <LinkedCreativeThumb
                          creative={creative}
                          disabled={busy}
                          onRemove={() => void onDetachCreative(creative.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || !name.trim()}
            >
              {saving ? "Guardando…" : "Guardar variante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VariantCreativePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        assignedCreativeIds={assignedIds}
        onConfirm={handleAttach}
        isPending={linking}
      />
    </>
  )
}
