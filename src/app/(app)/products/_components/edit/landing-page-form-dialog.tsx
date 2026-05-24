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
import type { LandingPageRecord } from "@/lib/services/landing-page"

interface LandingPageFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: LandingPageRecord | null
  onSubmit: (values: { url: string }) => Promise<void>
  isPending?: boolean
}

export function LandingPageFormDialog({
  open,
  onOpenChange,
  entry,
  onSubmit,
  isPending = false,
}: LandingPageFormDialogProps) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setUrl(entry?.url ?? "")
    setError(null)
  }, [open, entry])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!url.trim()) {
      setError("La URL es obligatoria")
      return
    }

    try {
      await onSubmit({ url: url.trim() })
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la landing page"
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Editar landing page" : "Nueva landing page"}
          </DialogTitle>
          <DialogDescription>
            URL completa o dominio con ruta. Se normalizará con https:// si falta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="landing-page-url" className="text-sm font-medium">
              URL
            </label>
            <Input
              id="landing-page-url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setError(null)
              }}
              placeholder="https://lp.calzadoselite.co/producto"
              disabled={isPending}
              spellCheck={false}
              autoFocus
            />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
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
            <Button type="submit" disabled={isPending || !url.trim()}>
              {isPending ? "Guardando…" : entry ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
