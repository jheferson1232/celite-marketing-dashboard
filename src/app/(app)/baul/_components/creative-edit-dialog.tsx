"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { RiDeleteBinLine, RiPlayCircleLine } from "@remixicon/react"
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
import type { CreativeRecord } from "@/lib/services/creative"
import type { ProductRecord } from "@/lib/services/product"
import { CreativeVariantAssociate } from "./creative-variant-associate"

interface CreativeEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  creative: CreativeRecord | null
  products: ProductRecord[]
  disabled?: boolean
  onSave: (values: {
    id: string
    name: string | null
    variantIds: string[]
  }) => Promise<void>
  onDelete: () => void
}

export function CreativeEditDialog({
  open,
  onOpenChange,
  creative,
  products,
  disabled = false,
  onSave,
  onDelete,
}: CreativeEditDialogProps) {
  const [name, setName] = useState("")
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !creative) return
    setName(creative.name ?? "")
    setAssignedIds(new Set(creative.variants.map((variant) => variant.id)))
    setError(null)
  }, [open, creative])

  const previewLabel = useMemo(() => {
    if (!creative) return "Creative"
    return name.trim() || creative.name?.trim() || creative.url.split("/").pop() || "Creative"
  }, [creative, name])

  const toggleAssociation = (variantId: string) => {
    setAssignedIds((current) => {
      const next = new Set(current)
      if (next.has(variantId)) next.delete(variantId)
      else next.add(variantId)
      return next
    })
  }

  const handleSave = async () => {
    if (!creative || disabled || saving) return

    setSaving(true)
    setError(null)

    try {
      await onSave({
        id: creative.id,
        name: name.trim() || null,
        variantIds: [...assignedIds],
      })
      onOpenChange(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el creative"
      )
    } finally {
      setSaving(false)
    }
  }

  if (!creative) return null

  return (
    <Dialog open={open} onOpenChange={disabled || saving ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[min(760px,92vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="space-y-1 border-b px-6 py-4">
          <DialogTitle>Editar creative</DialogTitle>
          <DialogDescription>
            Actualiza el nombre, asocia variantes o elimina el archivo del baúl.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="min-h-0 space-y-5 overflow-y-auto border-b px-6 py-5 md:border-r md:border-b-0">
            <div className="space-y-2">
              <label htmlFor="creative-name" className="text-sm font-medium">
                Nombre (opcional)
              </label>
              <Input
                id="creative-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Hero vertical azul"
                disabled={disabled || saving}
              />
            </div>

            <CreativeVariantAssociate
              products={products}
              assignedIds={assignedIds}
              disabled={disabled || saving}
              onToggleAssociation={toggleAssociation}
            />

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={disabled || saving}
              >
                <RiDeleteBinLine className="size-4" />
                Eliminar
              </Button>
            </div>
          </div>

          <aside className="flex min-h-[280px] flex-col bg-muted/20 p-5 md:min-h-0">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border bg-background shadow-sm">
              {creative.type === "image" ? (
                <Image
                  src={creative.url}
                  alt={previewLabel}
                  fill
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="relative h-full min-h-[240px]">
                  <video
                    src={creative.url}
                    className="h-full w-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                      <RiPlayCircleLine className="size-3" />
                      Video
                    </span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={disabled || saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={disabled || saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
