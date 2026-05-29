"use client"

import { useEffect, useState } from "react"
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
import {
  ProductMediaPicker,
  type LocalMediaItem,
} from "@/app/(app)/products/_components/product/product-media-picker"
import { buildProductMediaFormData } from "@/app/(app)/products/_components/product/product-media-picker"
import { uploadProductMediaAction } from "@/app/(app)/products/_actions/product-media"
import { runServerAction } from "@/lib/server-action"

export type PendingProductManualFormValues = {
  name: string
  dropiId: string
  url: string
  imageUrls: string[]
  price: string
}

interface PendingProductManualFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultName?: string
  onSubmit: (values: PendingProductManualFormValues) => Promise<void>
  isPending?: boolean
}

export function PendingProductManualForm({
  open,
  onOpenChange,
  defaultName = "",
  onSubmit,
  isPending = false,
}: PendingProductManualFormProps) {
  const [name, setName] = useState(defaultName)
  const [dropiId, setDropiId] = useState("")
  const [url, setUrl] = useState("")
  const [extraImageUrl, setExtraImageUrl] = useState("")
  const [price, setPrice] = useState("")
  const [localImages, setLocalImages] = useState<LocalMediaItem[]>([])
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(defaultName)
    setDropiId("")
    setUrl("")
    setExtraImageUrl("")
    setPrice("")
    setLocalImages([])
    setExistingImages([])
    setFormError(null)
  }, [open, defaultName])

  const busy = isPending || uploading

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || busy) return

    setFormError(null)
    setUploading(true)

    try {
      const imageUrls = [...existingImages]

      if (localImages.length > 0) {
        const formData = buildProductMediaFormData(localImages, "pendientes")
        const uploaded = await runServerAction(uploadProductMediaAction(formData))
        if (uploaded?.images?.length) {
          imageUrls.push(...uploaded.images)
        }
      }

      if (extraImageUrl.trim()) {
        imageUrls.push(extraImageUrl.trim())
      }

      await onSubmit({
        name: name.trim(),
        dropiId: dropiId.trim(),
        url: url.trim(),
        imageUrls,
        price: price.trim(),
      })

      for (const item of localImages) {
        URL.revokeObjectURL(item.previewUrl)
      }
      onOpenChange(false)
    } catch (error) {
      const raw =
        error instanceof Error ? error.message : "No se pudo agregar el producto"
      const short =
        raw.includes("Invalid `") && raw.includes("upsert()` invocation")
          ? raw.split("\n").find((line) => line.includes("Unknown argument")) ??
            raw.split("\n").find((line) => line.includes("does not exist")) ??
            "Error al guardar en la base de datos. Ejecuta `pnpm exec prisma db push`, luego `pnpm exec prisma generate` y reinicia `pnpm dev`."
          : raw.length > 280
            ? `${raw.slice(0, 280)}…`
            : raw
      setFormError(short)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar producto</DialogTitle>
          <DialogDescription>
            Crea el producto con sus datos e imágenes. La búsqueda en
            SociaVault se hace después desde la tabla.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="manual-name" className="text-sm font-medium">
              Nombre *
            </label>
            <Input
              id="manual-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Tenis Vans Sb"
              disabled={busy}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="manual-dropi-id" className="text-sm font-medium">
              Referencia (opcional)
            </label>
            <Input
              id="manual-dropi-id"
              value={dropiId}
              onChange={(e) => setDropiId(e.target.value)}
              placeholder="Se genera automático si está vacío"
              disabled={busy}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="manual-price" className="text-sm font-medium">
                Precio (opcional)
              </label>
              <Input
                id="manual-price"
                type="number"
                min={0}
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="125000"
                disabled={busy}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="manual-url" className="text-sm font-medium">
                URL producto (opcional)
              </label>
              <Input
                id="manual-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                disabled={busy}
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Imágenes</p>
            <ProductMediaPicker
              mode="images"
              existingImages={existingImages}
              existingVideos={[]}
              localItems={localImages}
              onLocalItemsChange={setLocalImages}
              onExistingImagesChange={setExistingImages}
              onExistingVideosChange={() => {}}
              disabled={busy}
            />
            <div className="flex gap-2">
              <Input
                type="url"
                value={extraImageUrl}
                onChange={(e) => setExtraImageUrl(e.target.value)}
                placeholder="O pegar URL de imagen adicional"
                disabled={busy}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy || !extraImageUrl.trim()}
                onClick={() => {
                  const trimmed = extraImageUrl.trim()
                  if (!trimmed || existingImages.includes(trimmed)) return
                  setExistingImages([...existingImages, trimmed])
                  setExtraImageUrl("")
                }}
              >
                Añadir URL
              </Button>
            </div>
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {uploading
                ? "Subiendo imágenes…"
                : isPending
                  ? "Guardando…"
                  : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
