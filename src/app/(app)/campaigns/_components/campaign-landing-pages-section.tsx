"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiLinkM,
  RiSearchLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  })

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return catalog
    return catalog.filter((page) => page.url.toLowerCase().includes(query))
  }, [catalog, search])

  const createMutation = useMutation({
    mutationFn: async (url: string) => {
      const created = await runServerAction(
        createCampaignLandingPageAction({ url })
      )
      if (!created) throw new Error("No se pudo crear la landing page")
      return created
    },
    onSuccess: async (created) => {
      void queryClient.invalidateQueries({
        queryKey: ["campaign-landing-pages-catalog"],
      })
      applyLandingSelection({ id: created.id, url: created.url })
      setNewLandingUrl("")
      setCreateError(null)
    },
    onError: (error) => {
      setCreateError(
        error instanceof Error
          ? error.message
          : "No se pudo crear la landing page"
      )
    },
  })

  const applyLandingSelection = (page: CampaignLandingPageRef) => {
    onLandingPagesChange([page])
    onSelectLandingPage(page.id)
  }

  const removeLanding = () => {
    onLandingPagesChange([])
    onSelectLandingPage("")
  }

  const isBusy = disabled || createMutation.isPending

  return (
    <Card size="sm" className="overflow-hidden">
      <CardHeader className="border-b pb-3">
        <CardTitle>Landing page</CardTitle>
        <CardDescription>
          Elegí una del catálogo o creá una nueva URL para esta campaña.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-4">
        {hasLanding ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
            <RiCheckLine className="size-4 shrink-0 text-primary" />
            <a
              href={selectedLanding.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
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
          <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-3 text-sm">
            Todavía no hay landing seleccionada.
          </p>
        )}

        <div className="relative">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por URL…"
            className="pl-8"
            disabled={isBusy}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Catálogo</p>
            {!isLoadingCatalog ? (
              <p className="text-muted-foreground text-xs">
                {filteredCatalog.length}
                {search.trim() ? ` de ${catalog.length}` : ""} landing
                {filteredCatalog.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border p-1">
            {isLoadingCatalog ? (
              <li className="text-muted-foreground px-3 py-6 text-center text-sm">
                Cargando catálogo…
              </li>
            ) : filteredCatalog.length === 0 ? (
              <li className="text-muted-foreground px-3 py-6 text-center text-sm">
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
                        applyLandingSelection({
                          id: page.id,
                          url: page.url,
                        })
                      }
                      className={cn(
                        "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition",
                        "hover:bg-muted/70",
                        selected && "bg-primary/5 ring-1 ring-primary/30"
                      )}
                    >
                      <RiLinkM className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1 break-all">{page.url}</span>
                      {selected ? (
                        <RiCheckLine className="mt-0.5 size-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-muted/10 p-3">
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
            <p className="text-destructive text-xs">{createError}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
