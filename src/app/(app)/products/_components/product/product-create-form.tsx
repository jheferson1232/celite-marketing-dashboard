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

export type ProductCreateFormValues = {
  name: string
  notes: string
}

interface ProductCreateFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ProductCreateFormValues) => Promise<void>
  isPending?: boolean
}

export function ProductCreateForm({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: ProductCreateFormProps) {
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName("")
    setNotes("")
    setFormError(null)
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || isPending) return

    setFormError(null)

    try {
      await onSubmit({
        name: name.trim(),
        notes: notes.trim(),
      })
      onOpenChange(false)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "No se pudo crear el producto"
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
          <DialogDescription>
            Indica un nombre para empezar. Podrás añadir imágenes y videos en la
            página de edición.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="create-product-name" className="text-sm font-medium">
              Nombre
            </label>
            <Input
              id="create-product-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Pantalón wide leg"
              required
              disabled={isPending}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="create-product-notes" className="text-sm font-medium">
              Notas (opcional)
            </label>
            <Textarea
              id="create-product-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Proveedor, observaciones..."
              disabled={isPending}
            />
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

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
              {isPending ? "Creando…" : "Crear y editar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
