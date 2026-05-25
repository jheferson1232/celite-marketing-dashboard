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
import { Textarea } from "@/components/ui/textarea"
import { getProductCoverImage } from "@/lib/products/cover-image"
import type { ProductRecord } from "@/lib/services/product"

interface ProductoFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductRecord | null
  onSubmit: (values: {
    name: string
    imageUrl: string
    notes: string
  }) => Promise<void>
  isPending?: boolean
}

export function ProductoForm({
  open,
  onOpenChange,
  product,
  onSubmit,
  isPending,
}: ProductoFormProps) {
  const [name, setName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open) return
    setName(product?.name ?? "")
    setImageUrl(product ? getProductCoverImage(product) ?? "" : "")
    setNotes(product?.notes ?? "")
  }, [open, product])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onSubmit({
      name: name.trim(),
      imageUrl: imageUrl.trim(),
      notes: notes.trim(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {product ? "Editar producto" : "Nuevo producto"}
          </DialogTitle>
          <DialogDescription>
            Nombre e imagen del producto en el catálogo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="product-name" className="text-sm font-medium">
              Nombre
            </label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Pantalón wide leg"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="product-image" className="text-sm font-medium">
              URL de imagen
            </label>
            <Input
              id="product-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="product-notes" className="text-sm font-medium">
              Notas (opcional)
            </label>
            <Textarea
              id="product-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Proveedor, observaciones..."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? "Guardando…" : product ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
