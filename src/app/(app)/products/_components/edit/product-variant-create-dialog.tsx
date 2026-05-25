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

export type ProductVariantCreateValues = {
  name: string
}

interface ProductVariantCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (values: ProductVariantCreateValues) => Promise<string | null>
  isPending?: boolean
}

export function ProductVariantCreateDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: ProductVariantCreateDialogProps) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName("")
    setError(null)
  }, [open])

  const handleConfirm = async () => {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError("El nombre es obligatorio.")
      return
    }

    setError(null)
    const createError = await onConfirm({
      name: trimmedName,
    })
    if (createError) {
      setError(createError)
      return
    }

    onOpenChange(false)
  }

  const formDisabled = isPending

  return (
    <Dialog open={open} onOpenChange={formDisabled ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva variante</DialogTitle>
          <DialogDescription>
            Añade una variante con nombre para este producto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <label htmlFor="variant-name" className="text-sm font-medium">
              Nombre
            </label>
            <Input
              id="variant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Negro, Azul marino"
              disabled={formDisabled}
              autoFocus
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={formDisabled}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={formDisabled || !name.trim()}
          >
            {isPending ? "Creando…" : "Crear variante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
