"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiArrowRightUpLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiFileCopyLine,
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
import { parseLandingPageParts } from "@/lib/url-match"
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

interface CatalogPage {
  id: string
  url: string
}

interface CatalogVariant {
  page: CatalogPage
  variantLabel: string
  variantKey: string
}

interface CatalogModelGroup {
  modelKey: string
  modelLabel: string
  variants: CatalogVariant[]
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function formatSelectedLabel(url: string): string {
  const parts = parseLandingPageParts(url)
  if (!parts.slug) return url
  if (!parts.variantKey) return parts.modelLabel
  return `${parts.modelLabel} · ${parts.variantLabel}`
}

function groupCatalogByModel(pages: CatalogPage[]): CatalogModelGroup[] {
  const groups = new Map<string, CatalogModelGroup>()

  for (const page of pages) {
    const parts = parseLandingPageParts(page.url)
    const existing = groups.get(parts.modelKey)
    const variant: CatalogVariant = {
      page,
      variantLabel: parts.variantLabel,
      variantKey: parts.variantKey,
    }

    if (existing) {
      existing.variants.push(variant)
    } else {
      groups.set(parts.modelKey, {
        modelKey: parts.modelKey,
        modelLabel: parts.modelLabel,
        variants: [variant],
      })
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      variants: group.variants.toSorted((a, b) =>
        a.variantLabel.localeCompare(b.variantLabel, "es", {
          sensitivity: "base",
        })
      ),
    }))
    .toSorted((a, b) =>
      a.modelLabel.localeCompare(b.modelLabel, "es", { sensitivity: "base" })
    )
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
  const [expandedModels, setExpandedModels] = useState<Set<string>>(
    () => new Set()
  )
  const [copyFeedbackId, setCopyFeedbackId] = useState<string | null>(null)

  const selectedLanding =
    landingPages.find((page) => page.id === selectedLandingPageId) ?? null
  const hasLanding = selectedLanding !== null

  const { data: catalog = [], isLoading: isLoadingCatalog } = useQuery({
    queryKey: ["campaign-landing-pages-catalog"],
    queryFn: () => runServerAction(listCampaignLandingPagesCatalogAction()),
    staleTime: 30 * 1000,
  })

  const modelGroups = useMemo(() => groupCatalogByModel(catalog), [catalog])

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return modelGroups

    return modelGroups
      .map((group) => {
        const modelMatches = group.modelLabel.toLowerCase().includes(query)
        const matchingVariants = group.variants.filter((variant) => {
          const haystack =
            `${variant.variantLabel} ${variant.page.url}`.toLowerCase()
          return haystack.includes(query)
        })

        if (modelMatches) return group
        if (matchingVariants.length === 0) return null
        return { ...group, variants: matchingVariants }
      })
      .filter((group): group is CatalogModelGroup => group !== null)
  }, [modelGroups, search])

  const selectedModelKey = useMemo(() => {
    if (!selectedLanding) return null
    return parseLandingPageParts(selectedLanding.url).modelKey
  }, [selectedLanding])

  useEffect(() => {
    if (!selectedModelKey) return
    setExpandedModels((prev) => {
      if (prev.has(selectedModelKey)) return prev
      const next = new Set(prev)
      next.add(selectedModelKey)
      return next
    })
  }, [selectedModelKey])

  useEffect(() => {
    const query = search.trim()
    if (!query) return
    setExpandedModels(new Set(filteredGroups.map((group) => group.modelKey)))
  }, [search, filteredGroups])

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

  const toggleModel = (modelKey: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev)
      if (next.has(modelKey)) next.delete(modelKey)
      else next.add(modelKey)
      return next
    })
  }

  const copyUrl = async (pageId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyFeedbackId(pageId)
      window.setTimeout(() => {
        setCopyFeedbackId((current) => (current === pageId ? null : current))
      }, 1500)
    } catch {
      // Clipboard puede fallar sin permiso; el link sigue disponible.
    }
  }

  const isBusy = disabled || createMutation.isPending
  const variantCount = filteredGroups.reduce(
    (sum, group) => sum + group.variants.length,
    0
  )

  return (
    <Card size="sm" className="overflow-hidden">
      <CardHeader className="border-b pb-3">
        <CardTitle>Landing page</CardTitle>
        <CardDescription>
          Buscá por modelo o color, o pegá el link a mano. La estrategia no
          cambia: solo elegís la URL.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-4">
        {hasLanding ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
            <RiCheckLine className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <a
                href={selectedLanding.url}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm font-medium hover:underline"
              >
                {formatSelectedLabel(selectedLanding.url)}
              </a>
              <p className="text-muted-foreground truncate text-xs">
                {selectedLanding.url}
              </p>
            </div>
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
            placeholder="Buscar modelo o color…"
            className="pl-8"
            disabled={isBusy}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Catálogo</p>
            {!isLoadingCatalog ? (
              <p className="text-muted-foreground text-xs">
                {filteredGroups.length} modelo
                {filteredGroups.length === 1 ? "" : "s"}
                {" · "}
                {variantCount} link
                {variantCount === 1 ? "" : "s"}
                {search.trim() ? ` (de ${catalog.length})` : ""}
              </p>
            ) : null}
          </div>

          <ul className="flex max-h-80 flex-col overflow-y-auto rounded-lg border">
            {isLoadingCatalog ? (
              <li className="text-muted-foreground px-3 py-6 text-center text-sm">
                Cargando catálogo…
              </li>
            ) : filteredGroups.length === 0 ? (
              <li className="text-muted-foreground px-3 py-6 text-center text-sm">
                {catalog.length === 0
                  ? "No hay landing pages en el catálogo."
                  : "Ningún modelo o color coincide con la búsqueda."}
              </li>
            ) : (
              filteredGroups.map((group) => {
                const expanded = expandedModels.has(group.modelKey)
                const hasSelected = group.variants.some(
                  (variant) => variant.page.id === selectedLandingPageId
                )

                return (
                  <li
                    key={group.modelKey}
                    className="border-b last:border-b-0"
                  >
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggleModel(group.modelKey)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition",
                        "hover:bg-muted/70",
                        hasSelected && "bg-primary/5"
                      )}
                    >
                      {expanded ? (
                        <RiArrowDownSLine className="text-muted-foreground size-4 shrink-0" />
                      ) : (
                        <RiArrowRightSLine className="text-muted-foreground size-4 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {group.modelLabel}
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {group.variants.length}
                      </span>
                    </button>

                    {expanded ? (
                      <ul className="border-t bg-muted/10">
                        {group.variants.map((variant) => {
                          const selected =
                            variant.page.id === selectedLandingPageId
                          return (
                            <li
                              key={variant.page.id}
                              className="flex items-stretch border-b last:border-b-0"
                            >
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  applyLandingSelection({
                                    id: variant.page.id,
                                    url: variant.page.url,
                                  })
                                }
                                className={cn(
                                  "flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5 pl-9 text-left transition",
                                  "hover:bg-muted/70",
                                  selected && "bg-primary/5"
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {variant.variantLabel}
                                  </p>
                                  <p className="text-muted-foreground truncate text-xs">
                                    {variant.page.url}
                                  </p>
                                </div>
                                {selected ? (
                                  <RiCheckLine className="mt-0.5 size-4 shrink-0 text-primary" />
                                ) : null}
                              </button>
                              <div className="flex shrink-0 items-center gap-0.5 pr-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={isBusy}
                                  aria-label={
                                    copyFeedbackId === variant.page.id
                                      ? "URL copiada"
                                      : "Copiar URL"
                                  }
                                  onClick={() =>
                                    void copyUrl(
                                      variant.page.id,
                                      variant.page.url
                                    )
                                  }
                                >
                                  {copyFeedbackId === variant.page.id ? (
                                    <RiCheckLine className="size-3.5 text-primary" />
                                  ) : (
                                    <RiFileCopyLine className="size-3.5" />
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={isBusy}
                                  aria-label="Abrir landing"
                                  asChild
                                >
                                  <a
                                    href={variant.page.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <RiArrowRightUpLine className="size-3.5" />
                                  </a>
                                </Button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </li>
                )
              })
            )}
          </ul>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border bg-muted/10 p-3">
          <p className="text-sm font-medium">Pegar link manual</p>
          <p className="text-muted-foreground text-xs">
            Si ya tenés la URL, pegala acá y se selecciona para esta campaña.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="url"
              value={newLandingUrl}
              placeholder="https://lp.calzadoselite.co/modelo--color"
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
              Usar
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
