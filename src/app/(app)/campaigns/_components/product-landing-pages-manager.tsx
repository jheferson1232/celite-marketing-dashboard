"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiAddLine, RiDeleteBinLine, RiLinkM } from "@remixicon/react"
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
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import {
  createProductLandingPageAction,
  getLandingPageCampaignUsageAction,
  linkProductLandingPageAction,
  listAvailableProductLandingPagesAction,
  listProductLandingPagesAction,
  unlinkProductLandingPageAction,
} from "../_actions/product-landing-pages"

type LandingPageOption = {
  id: string
  url: string
}

interface ProductLandingPagesManagerProps {
  productId: string
  campaignId: string
  selectedLandingPageId: string
  disabled?: boolean
  landingPages: LandingPageOption[]
  onLandingPagesChange: (pages: LandingPageOption[]) => void
  onSelectLandingPage: (landingPageId: string) => void
}

export function ProductLandingPagesManager({
  productId,
  campaignId,
  selectedLandingPageId,
  disabled = false,
  landingPages,
  onLandingPagesChange,
  onSelectLandingPage,
}: ProductLandingPagesManagerProps) {
  const queryClient = useQueryClient()
  const [newLandingUrl, setNewLandingUrl] = useState("")
  const [associateLandingPageId, setAssociateLandingPageId] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<LandingPageOption | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: availableLandingPages = [] } = useQuery({
    queryKey: ["available-landing-pages", productId],
    queryFn: () => runServerAction(listAvailableProductLandingPagesAction(productId)),
    staleTime: 30 * 1000,
  })

  const { data: deleteUsage = [], isLoading: isLoadingDeleteUsage } = useQuery({
    queryKey: ["landing-page-campaign-usage", deleteTarget?.id],
    queryFn: () =>
      deleteTarget
        ? runServerAction(getLandingPageCampaignUsageAction(deleteTarget.id))
        : Promise.resolve([]),
    enabled: Boolean(deleteTarget),
  })

  const refreshLandingPages = async () => {
    const pages = await runServerAction(listProductLandingPagesAction(productId))
    if (!pages) return

    onLandingPagesChange(
      pages.map((page) => ({
        id: page.id,
        url: page.url,
      }))
    )
    void queryClient.invalidateQueries({ queryKey: ["available-landing-pages", productId] })
    void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] })
    void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
  }

  const createMutation = useMutation({
    mutationFn: async (url: string) => {
      const created = await runServerAction(
        createProductLandingPageAction({ productId, url })
      )
      if (!created) throw new Error("No se pudo crear la landing page")
      return created
    },
    onSuccess: async (created) => {
      setNewLandingUrl("")
      await refreshLandingPages()
      onSelectLandingPage(created.id)
    },
  })

  const linkMutation = useMutation({
    mutationFn: async (landingPageId: string) => {
      const linked = await runServerAction(
        linkProductLandingPageAction({
          productId,
          landingPageId,
        })
      )
      if (!linked) throw new Error("No se pudo asociar la landing page")
      return linked
    },
    onSuccess: async (linked) => {
      setAssociateLandingPageId("")
      await refreshLandingPages()
      onSelectLandingPage(linked.id)
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: async (landingPageId: string) =>
      runServerAction(
        unlinkProductLandingPageAction({
          productId,
          landingPageId,
        })
      ),
    onSuccess: async (_result, landingPageId) => {
      setDeleteTarget(null)
      setDeleteError(null)

      const pages = await runServerAction(listProductLandingPagesAction(productId))
      if (!pages) return

      const nextPages = pages.map((page) => ({
        id: page.id,
        url: page.url,
      }))
      onLandingPagesChange(nextPages)

      if (selectedLandingPageId === landingPageId) {
        onSelectLandingPage(nextPages[0]?.id ?? "")
      }

      void queryClient.invalidateQueries({ queryKey: ["available-landing-pages", productId] })
      void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] })
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] })
    },
    onError: (error) => {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar")
    },
  })

  const isBusy =
    disabled ||
    createMutation.isPending ||
    linkMutation.isPending ||
    unlinkMutation.isPending

  const canConfirmDelete = deleteUsage.length === 0 && !isLoadingDeleteUsage

  const associateOptions = useMemo(
    () =>
      availableLandingPages.filter(
        (page) => !landingPages.some((linked) => linked.id === page.id)
      ),
    [availableLandingPages, landingPages]
  )

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Landing pages del producto</label>
        <p className="text-xs text-muted-foreground">
          Administra las landing pages asociadas al producto y elige cuál usar en
          esta campaña.
        </p>
      </div>

      {landingPages.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          No hay landing pages asociadas a este producto.
        </p>
      ) : (
        <ul className="space-y-2">
          {landingPages.map((page) => {
            const selected = selectedLandingPageId === page.id
            return (
              <li
                key={page.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  selected && "border-primary/40 bg-primary/5"
                )}
              >
                <input
                  type="radio"
                  id={`landing-${page.id}`}
                  name="campaign-landing-page"
                  checked={selected}
                  disabled={isBusy}
                  onChange={() => onSelectLandingPage(page.id)}
                  className="size-4 shrink-0 accent-primary"
                />
                <label
                  htmlFor={`landing-${page.id}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <p className="truncate text-sm">{page.url}</p>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isBusy}
                  aria-label={`Eliminar landing page ${page.url}`}
                  onClick={() => {
                    setDeleteError(null)
                    setDeleteTarget(page)
                  }}
                >
                  <RiDeleteBinLine className="size-4 text-destructive" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
        <p className="text-sm font-medium">Agregar landing page</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newLandingUrl}
            disabled={isBusy}
            placeholder="https://ejemplo.com/landing"
            onChange={(event) => setNewLandingUrl(event.target.value)}
          />
          <Button
            type="button"
            disabled={isBusy || newLandingUrl.trim().length === 0}
            onClick={() => createMutation.mutate(newLandingUrl)}
          >
            <RiAddLine className="size-4" />
            Crear
          </Button>
        </div>
        {createMutation.isError ? (
          <p className="text-xs text-destructive">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "No se pudo crear la landing page"}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
        <p className="text-sm font-medium">Asociar existente</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className={cn(
              "border-input bg-background flex h-9 min-w-0 flex-1 rounded-md border px-3 text-sm shadow-xs",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            value={associateLandingPageId}
            disabled={isBusy || associateOptions.length === 0}
            onChange={(event) => setAssociateLandingPageId(event.target.value)}
          >
            <option value="">
              {associateOptions.length === 0
                ? "No hay landing pages disponibles"
                : "Selecciona una landing page"}
            </option>
            {associateOptions.map((page) => (
              <option key={page.id} value={page.id}>
                {page.url}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy || !associateLandingPageId}
            onClick={() => linkMutation.mutate(associateLandingPageId)}
          >
            <RiLinkM className="size-4" />
            Asociar
          </Button>
        </div>
        {linkMutation.isError ? (
          <p className="text-xs text-destructive">
            {linkMutation.error instanceof Error
              ? linkMutation.error.message
              : "No se pudo asociar la landing page"}
          </p>
        ) : null}
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent showCloseButton={!unlinkMutation.isPending}>
          <DialogHeader>
            <DialogTitle>¿Eliminar landing page?</DialogTitle>
            <DialogDescription>
              Se desasociará del producto. Esta acción no se puede deshacer si la
              landing page ya no está en uso en otros productos.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget ? (
            <div className="space-y-3">
              <p className="truncate rounded-md border bg-muted/20 px-3 py-2 text-sm">
                {deleteTarget.url}
              </p>

              {isLoadingDeleteUsage ? (
                <p className="text-sm text-muted-foreground">
                  Verificando campañas asociadas…
                </p>
              ) : deleteUsage.length > 0 ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <p className="font-medium">
                    No se puede eliminar: {deleteUsage.length} campaña(s) usan esta
                    landing page.
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    {deleteUsage.map((campaign) => (
                      <li key={campaign.id}>{campaign.name}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ninguna campaña usa esta landing page. Puedes eliminarla con
                  seguridad.
                </p>
              )}

              {deleteError ? (
                <p className="text-sm text-destructive">{deleteError}</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={unlinkMutation.isPending}
              onClick={() => {
                setDeleteTarget(null)
                setDeleteError(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteTarget || !canConfirmDelete || unlinkMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return
                unlinkMutation.mutate(deleteTarget.id)
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
