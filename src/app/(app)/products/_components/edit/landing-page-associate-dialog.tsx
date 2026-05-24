"use client"

import { useEffect, useMemo, useState } from "react"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiLinkM,
  RiLinkUnlinkM,
  RiPencilLine,
  RiSearchLine,
} from "@remixicon/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { LandingPageRecord } from "@/lib/services/landing-page"

interface LandingPageAssociateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: LandingPageRecord[]
  assignedIds: Set<string>
  isLoading?: boolean
  disabled?: boolean
  onToggleAssociation: (landingPage: LandingPageRecord) => void
  onEdit: (landingPage: LandingPageRecord) => void
  onDelete: (landingPage: LandingPageRecord) => void
  onCreateNew: () => void
}

export function LandingPageAssociateDialog({
  open,
  onOpenChange,
  catalog,
  assignedIds,
  isLoading = false,
  disabled = false,
  onToggleAssociation,
  onEdit,
  onDelete,
  onCreateNew,
}: LandingPageAssociateDialogProps) {
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) return
    setSearch("")
  }, [open])

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase()
    const sorted = [...catalog].sort((a, b) => a.url.localeCompare(b.url))
    if (!query) return sorted
    return sorted.filter((page) => page.url.toLowerCase().includes(query))
  }, [catalog, search])

  return (
    <Dialog open={open} onOpenChange={disabled ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[min(640px,90vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="space-y-1 border-b px-6 py-4">
          <DialogTitle>Asociar landing pages</DialogTitle>
          <DialogDescription>
            Busca, crea, edita o elimina landing pages. Usa el icono de enlace
            para asociar o desasociar. Guarda el producto para persistir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 border-b px-6 py-4">
          <div className="relative">
            <RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por URL…"
              className="pl-8"
              disabled={disabled || isLoading}
              spellCheck={false}
              autoFocus
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            disabled={disabled}
            onClick={onCreateNew}
          >
            <RiAddLine className="size-4" />
            Nueva landing page
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : catalog.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              No hay landing pages en el catálogo. Crea una nueva para empezar.
            </p>
          ) : filteredCatalog.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              Ninguna URL coincide con la búsqueda.
            </p>
          ) : (
            <ul className="space-y-1">
              {filteredCatalog.map((landingPage) => {
                const isAssigned = assignedIds.has(landingPage.id)
                return (
                  <li
                    key={landingPage.id}
                    className={cn(
                      "flex items-stretch gap-0.5 rounded-md border border-transparent",
                      isAssigned && "border-primary/20 bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "min-w-0 flex-1 px-2 py-2 font-mono text-xs leading-snug",
                        isAssigned && "text-primary"
                      )}
                      title={landingPage.url}
                    >
                      <span className="line-clamp-2 break-all">{landingPage.url}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "size-9 shrink-0 rounded-none",
                        isAssigned && "text-primary hover:text-primary"
                      )}
                      disabled={disabled}
                      aria-pressed={isAssigned}
                      aria-label={
                        isAssigned
                          ? `Desasociar ${landingPage.url}`
                          : `Asociar ${landingPage.url}`
                      }
                      onClick={() => onToggleAssociation(landingPage)}
                    >
                      {isAssigned ? (
                        <RiLinkUnlinkM className="size-4" />
                      ) : (
                        <RiLinkM className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 rounded-none"
                      disabled={disabled}
                      aria-label={`Editar ${landingPage.url}`}
                      onClick={() => onEdit(landingPage)}
                    >
                      <RiPencilLine className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 rounded-r-md text-destructive hover:text-destructive"
                      disabled={disabled}
                      aria-label={`Eliminar ${landingPage.url}`}
                      onClick={() => onDelete(landingPage)}
                    >
                      <RiDeleteBinLine className="size-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
