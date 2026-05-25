"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiDeleteBinLine,
  RiLinkM,
  RiSearchLine,
} from "@remixicon/react"
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
import type { CampaignLandingPageRef } from "@/lib/config/tiktok-strategies"
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import {
  createCampaignLandingPageAction,
  listCampaignLandingPagesCatalogAction,
} from "../_actions/campaign-landing-pages"

interface CampaignLandingPagesSectionProps {
  landingPages: CampaignLandingPageRef[]
  selectedLandingPageId: string
  disabled?: boolean
  onLandingPagesChange: (pages: CampaignLandingPageRef[]) => void
  onSelectLandingPage: (landingPageId: string) => void
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function CampaignLandingPagesSection({
  landingPages,
  selectedLandingPageId,
  disabled = false,
  onLandingPagesChange,
  onSelectLandingPage,
}: CampaignLandingPagesSectionProps) {
  const queryClient = useQueryClient()
  const didAutoOpenRef = useRef(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [newLandingUrl, setNewLandingUrl] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)

  const selectedLanding =
    landingPages.find((page) => page.id === selectedLandingPageId) ?? null
  const hasLanding = selectedLanding !== null

  const { data: catalog = [], isLoading: isLoadingCatalog } = useQuery({
    queryKey: ["campaign-landing-pages-catalog"],
    queryFn: () => runServerAction(listCampaignLandingPagesCatalogAction()),
    staleTime: 30 * 1000,
    enabled: dialogOpen,
  })

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return catalog
    return catalog.filter((page) => page.url.toLowerCase().includes(query))
  }, [catalog, search])

  const createMutation = useMutation({
    mutationFn: async (url: string) => {
      const created = await runServerAction(createCampaignLandingPageAction({ url }))
      if (!created) throw new Error("No se pudo crear la landing page")
      return created
    },
    onSuccess: async (created) => {
      void queryClient.invalidateQueries({ queryKey: ["campaign-landing-pages-catalog"] })
      applyLandingSelection({ id: created.id, url: created.url })
      resetDialogState()
    },
    onError: (error) => {
      setCreateError(
        error instanceof Error ? error.message : "No se pudo crear la landing page"
      )
    },
  })

  const applyLandingSelection = (page: CampaignLandingPageRef) => {
    onLandingPagesChange([page])
    onSelectLandingPage(page.id)
    setDialogOpen(false)
  }

  const resetDialogState = () => {
    setSearch("")
    setNewLandingUrl("")
    setCreateError(null)
  }

  const openDialog = () => {
    resetDialogState()
    setDialogOpen(true)
  }

  useEffect(() => {
    if (disabled || didAutoOpenRef.current || hasLanding) return
    didAutoOpenRef.current = true
    setDialogOpen(true)
  }, [disabled, hasLanding])

  const removeLanding = () => {
    onLandingPagesChange([])
    onSelectLandingPage("")
  }

  const isBusy = disabled || createMutation.isPending

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium">Landing page</label>
        <p className="text-xs text-muted-foreground">
          URL de destino para los anuncios de esta campaña.
        </p>
      </div>

      {hasLanding ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
          <RiLinkM className="size-4 shrink-0 text-primary" />
          <a
            href={selectedLanding.url}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-sm hover:underline"
          >
            {selectedLanding.url}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            aria-label="Abrir landing page"
            asChild
          >
            <a href={selectedLanding.url} target="_blank" rel="noreferrer">
              <RiArrowRightUpLine className="size-4" />
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            onClick={openDialog}
          >
            Cambiar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            aria-label="Quitar landing page"
            onClick={removeLanding}
          >
            <RiDeleteBinLine className="size-4 text-destructive" />
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">
            No hay landing page asociada a esta campaña.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={isBusy}
            onClick={openDialog}
          >
            <RiLinkM className="size-4" />
            Seleccionar landing page
          </Button>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open && createMutation.isPending) return
          setDialogOpen(open)
          if (!open) resetDialogState()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Seleccionar landing page</DialogTitle>
            <DialogDescription>
              Busca en el catálogo, elige una existente o crea una nueva URL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por URL…"
                className="pl-8"
                disabled={isBusy}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Catálogo</p>
              <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-1">
                {isLoadingCatalog ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Cargando catálogo…
                  </li>
                ) : filteredCatalog.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {catalog.length === 0
                      ? "No hay landing pages en el catálogo."
                      : "Ninguna URL coincide con la búsqueda."}
                  </li>
                ) : (
                  filteredCatalog.map((page) => {
                    const selected = page.id === selectedLandingPageId
                    return (
                      <li key={page.id}>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            applyLandingSelection({ id: page.id, url: page.url })
                          }
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition",
                            "hover:bg-muted/70",
                            selected && "bg-primary/5"
                          )}
                        >
                          <RiLinkM className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 truncate">{page.url}</span>
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
              <p className="text-sm font-medium">Crear nueva</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="url"
                  value={newLandingUrl}
                  placeholder="https://ejemplo.com/landing"
                  disabled={isBusy}
                  onChange={(event) => {
                    setNewLandingUrl(event.target.value)
                    setCreateError(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      const url = normalizeUrl(newLandingUrl)
                      if (url) createMutation.mutate(url)
                    }
                  }}
                />
                <Button
                  type="button"
                  disabled={isBusy || !newLandingUrl.trim()}
                  onClick={() => {
                    const url = normalizeUrl(newLandingUrl)
                    if (!url) {
                      setCreateError("La URL no puede estar vacía.")
                      return
                    }
                    createMutation.mutate(url)
                  }}
                >
                  <RiAddLine className="size-4" />
                  Crear
                </Button>
              </div>
              {createError ? (
                <p className="text-xs text-destructive">{createError}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createMutation.isPending}
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
