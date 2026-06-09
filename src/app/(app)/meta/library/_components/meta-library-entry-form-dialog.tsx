"use client"

import { useState } from "react"
import { RiSave3Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { MetaLibraryEntryRecord } from "@/lib/services/meta/library/meta-library-entries"

type FormState = {
  url: string
  facebookPage: string
}

const emptyForm: FormState = { url: "", facebookPage: "" }

function MetaLibraryEntryForm({
  entry,
  busy,
  onCancel,
  onSubmit,
}: {
  entry?: MetaLibraryEntryRecord | null
  busy: boolean
  onCancel: () => void
  onSubmit: (data: FormState) => Promise<void>
}) {
  const [form, setForm] = useState<FormState>(() =>
    entry
      ? {
          url: entry.url ?? "",
          facebookPage: entry.facebookPage ?? "",
        }
      : emptyForm
  )

  const hasStore = form.url.trim().length > 0
  const hasPage = form.facebookPage.trim().length > 0
  const canSave = hasStore || hasPage

  return (
    <>
      <div className="space-y-4 py-2">
        <p className="text-muted-foreground text-sm">
          Completa la tienda, la página de Facebook, o ambas.
        </p>

        <div className="space-y-2">
          <label htmlFor="meta-library-url" className="text-sm font-medium">
            Tienda (URL)
            <span className="text-muted-foreground ml-1 font-normal">opcional</span>
          </label>
          <Input
            id="meta-library-url"
            value={form.url}
            onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
            placeholder="https://tienda.com"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="meta-library-facebook-page"
            className="text-sm font-medium"
          >
            Página de Facebook
            <span className="text-muted-foreground ml-1 font-normal">opcional</span>
          </label>
          <Input
            id="meta-library-facebook-page"
            value={form.facebookPage}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, facebookPage: e.target.value }))
            }
            placeholder="Nombre o URL en Meta Ad Library"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={!canSave || busy}
          onClick={() => void onSubmit(form)}
        >
          <RiSave3Line className="size-4" />
          {busy ? "Guardando…" : entry ? "Guardar cambios" : "Agregar"}
        </Button>
      </DialogFooter>
    </>
  )
}

export function MetaLibraryEntryFormDialog({
  open,
  onOpenChange,
  entry,
  busy,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: MetaLibraryEntryRecord | null
  busy: boolean
  onSubmit: (data: FormState) => Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Editar entrada" : "Agregar tienda o página"}
          </DialogTitle>
          <DialogDescription>
            Registra una tienda, una página de Facebook en Meta Ad Library, o
            ambas para seguimiento.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <MetaLibraryEntryForm
            key={entry?.id ?? "new"}
            entry={entry}
            busy={busy}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
