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

export type StorePendingManualFormValues = {
  source: string
}

interface StorePendingManualFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: StorePendingManualFormValues) => Promise<void>
  isPending?: boolean
}

export function StorePendingManualForm({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: StorePendingManualFormProps) {
  const [source, setSource] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSource("")
    setFormError(null)
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!source.trim() || isPending) return

    setFormError(null)
    try {
      await onSubmit({ source: source.trim() })
      onOpenChange(false)
    } catch (error) {
      const raw =
        error instanceof Error ? error.message : "No se pudo guardar la tienda."
      const short =
        raw.includes("Invalid `") && raw.includes("findFirst()` invocation")
          ? (raw.split("\n").find((line) => /does not exist|P2021|relation/i.test(line)) ??
            "Faltan tablas de tiendas en la base de datos. Ejecuta `pnpm exec prisma migrate deploy` (local) o redeploy en Vercel.")
          : /P2021|does not exist|relation.*StorePending/i.test(raw)
            ? "Faltan tablas de tiendas en la base de datos. Ejecuta `pnpm exec prisma migrate deploy` (local) o redeploy en Vercel."
            : raw.length > 280
              ? `${raw.slice(0, 280)}…`
              : raw
      setFormError(short)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar tienda</DialogTitle>
          <DialogDescription>
            Pega la URL de la página de Facebook o el dominio de la tienda.
            Usaremos eso para buscar anuncios en Meta Ad Library con SocialVault.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="store-source" className="text-sm font-medium">
              Página de Facebook o dominio de tienda
            </label>
            <Input
              id="store-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="https://facebook.com/mitienda o mitienda.com"
              disabled={isPending}
              required
            />
            <p className="text-muted-foreground text-xs">
              Ejemplos:{" "}
              <span className="font-mono">facebook.com/ryoraku</span> ·{" "}
              <span className="font-mono">ryoraku.store</span>
            </p>
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
            <Button type="submit" disabled={isPending || !source.trim()}>
              {isPending ? "Guardando…" : "Guardar tienda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
