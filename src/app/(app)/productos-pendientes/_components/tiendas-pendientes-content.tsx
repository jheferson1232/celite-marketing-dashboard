"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiMetaLine,
  RiRefreshLine,
  RiStore2Line,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import type {
  StorePendingRecord,
  StorePendingStatus,
} from "@/lib/services/store-pending/types"
import { describeStoreMetaCreditsPerScrape } from "@/lib/services/sociavault/search-store-meta"
import {
  addStorePendingAction,
  deleteStorePendingAction,
  getSociaVaultStoresSetupStatusAction,
  listStorePendingAction,
  scrapeStorePendingMetaAction,
} from "../_actions/pending-stores"
import { StorePendingManualForm } from "./store-pending-manual-form"
import { StorePendingDetailSheet } from "./store-pending-detail-sheet"

const STATUS_LABEL: Record<StorePendingStatus, string> = {
  IMPORTED: "Importada",
  SEARCHING: "Scrapeando",
  MATCHED: "Con anuncios",
  NO_MATCH: "Sin anuncios",
  ERROR: "Error",
}

function statusBadgeClass(status: StorePendingStatus): string {
  switch (status) {
    case "MATCHED":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "NO_MATCH":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    case "ERROR":
      return "bg-destructive/15 text-destructive"
    case "SEARCHING":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—"
  const value = typeof date === "string" ? new Date(date) : date
  return value.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function StoreThumbnailRow({
  store,
  isScraping,
  isDeleting,
  onScrape,
  onDelete,
  onView,
}: {
  store: StorePendingRecord
  isScraping: boolean
  isDeleting: boolean
  onScrape: () => void
  onDelete: () => void
  onView: () => void
}) {
  const latest = store.latestSnapshot
  const activeAds = latest?.activeAds ?? store.activeCreativeCount
  const totalAds = latest?.totalAds ?? store.creativeCount
  const topCountry = latest?.topCountries[0]?.code ?? store.country

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-start gap-3">
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.logoUrl}
              alt=""
              className="size-11 rounded-md border object-cover"
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-md">
              <RiStore2Line className="size-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium leading-snug">{store.name}</p>
            {store.domain ? (
              <p className="text-muted-foreground text-xs">{store.domain}</p>
            ) : store.pageUrl ? (
              <p className="text-muted-foreground line-clamp-1 text-xs">
                {store.pageUrl.replace(/^https?:\/\//, "")}
              </p>
            ) : null}
            <p className="text-muted-foreground mt-1 text-[11px]">
              Creada el {formatDate(store.createdAt)}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <p className="text-sm font-medium tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">
              {activeAds}
            </span>{" "}
            activos / {totalAds} total
          </p>
          <Badge
            variant="secondary"
            className={cn("font-normal", statusBadgeClass(store.status))}
          >
            {STATUS_LABEL[store.status]}
          </Badge>
          {store.lastError ? (
            <p className="max-w-xs text-xs text-amber-600 dark:text-amber-500">
              {store.lastError}
            </p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <p className="font-medium">{topCountry}</p>
          <p className="text-muted-foreground text-xs">
            {latest?.topCountries[0]?.count ?? 0} anuncios
          </p>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDate(store.lastSyncedAt)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onScrape}
            disabled={isScraping || isDeleting}
          >
            <RiRefreshLine
              className={cn("size-3.5", isScraping && "animate-spin")}
            />
            {isScraping ? "Scrapeando…" : "Scrapear Meta"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onView}>
            <RiEyeLine className="size-3.5" />
            Ver detalle
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isScraping || isDeleting}
            onClick={onDelete}
          >
            <RiDeleteBinLine className="size-3.5" />
            {isDeleting ? "Eliminando…" : "Eliminar"}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function TiendasPendientesContent() {
  const queryClient = useQueryClient()
  const [manualFormOpen, setManualFormOpen] = useState(false)
  const [detailStore, setDetailStore] = useState<StorePendingRecord | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data: stores = [], isLoading, isError, error } = useQuery({
    queryKey: ["store-pending"],
    queryFn: () => runServerAction(listStorePendingAction()),
    staleTime: 15_000,
  })

  const { data: sociavaultSetup } = useQuery({
    queryKey: ["sociavault-stores-setup"],
    queryFn: () => runServerAction(getSociaVaultStoresSetupStatusAction()),
    staleTime: 60_000,
  })

  const sociavaultConfigured = sociavaultSetup?.configured ?? true

  const addStoreMutation = useMutation({
    mutationFn: (values: { source: string }) =>
      runServerAction(addStorePendingAction(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store-pending"] })
    },
  })

  const scrapeMutation = useMutation({
    mutationFn: (storeId: string) =>
      runServerAction(scrapeStorePendingMetaAction(storeId)),
    onSuccess: (detail) => {
      void queryClient.invalidateQueries({ queryKey: ["store-pending"] })
      if (detail?.id) {
        void queryClient.invalidateQueries({
          queryKey: ["store-pending-detail", detail.id],
        })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (storeId: string) =>
      runServerAction(deleteStorePendingAction(storeId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store-pending"] })
    },
  })

  const counts = useMemo(() => {
    const base = {
      total: stores.length,
      matched: 0,
      noMatch: 0,
      error: 0,
    }
    for (const store of stores) {
      if (store.status === "MATCHED") base.matched++
      else if (store.status === "NO_MATCH") base.noMatch++
      else if (store.status === "ERROR") base.error++
    }
    return base
  }, [stores])

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <RiMetaLine className="size-5" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Meta Ad Library
            </span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Tiendas</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Agrega tiendas o páginas y usa{" "}
            <strong className="text-foreground">Scrapear Meta</strong> para
            traer anuncios activos desde SocialVault.{" "}
            <strong className="text-foreground">
              {describeStoreMetaCreditsPerScrape()}
            </strong>
            .
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setManualFormOpen(true)}
          disabled={addStoreMutation.isPending}
        >
          <RiAddLine className="size-4" />
          Agregar tienda
        </Button>
      </div>

      <StorePendingManualForm
        open={manualFormOpen}
        onOpenChange={setManualFormOpen}
        isPending={addStoreMutation.isPending}
        onSubmit={async (values) => {
          await addStoreMutation.mutateAsync({ source: values.source })
        }}
      />

      {!sociavaultConfigured ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-medium">Falta SOCIAVAULT_API_KEY en Vercel</p>
          <p className="mt-1 text-destructive/90">
            Configura la API key y vuelve a intentar el scrape.
          </p>
        </div>
      ) : null}

      {scrapeMutation.isError ? (
        <p className="text-sm text-destructive">
          {scrapeMutation.error instanceof Error
            ? scrapeMutation.error.message
            : "No se pudo scrapear la tienda."}
        </p>
      ) : null}

      <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
        <span>
          <strong className="text-foreground">{counts.total}</strong> tiendas
        </span>
        <span>
          <strong className="text-foreground">{counts.matched}</strong> con
          anuncios
        </span>
        <span>
          <strong className="text-foreground">{counts.noMatch}</strong> sin
          resultados
        </span>
        <span>
          <strong className="text-foreground">{counts.error}</strong> con error
        </span>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : "No se pudieron cargar las tiendas."}
        </p>
      ) : stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <RiStore2Line className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Aún no hay tiendas registradas</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Pulsa <strong className="text-foreground">Agregar tienda</strong> y
            luego scrapea anuncios Meta desde cada fila.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comercio</TableHead>
                <TableHead>Anuncios Meta</TableHead>
                <TableHead>Tráfico por país</TableHead>
                <TableHead>Última sync</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((store) => (
                <StoreThumbnailRow
                  key={store.id}
                  store={store}
                  isScraping={
                    scrapeMutation.isPending &&
                    scrapeMutation.variables === store.id
                  }
                  isDeleting={
                    deleteMutation.isPending &&
                    deleteMutation.variables === store.id
                  }
                  onScrape={() => {
                    if (scrapeMutation.isPending) return
                    scrapeMutation.mutate(store.id)
                  }}
                  onDelete={() => {
                    if (
                      !window.confirm(
                        `¿Eliminar "${store.name}" y sus anuncios guardados?`
                      )
                    ) {
                      return
                    }
                    deleteMutation.mutate(store.id)
                  }}
                  onView={() => {
                    setDetailStore(store)
                    setDetailOpen(true)
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StorePendingDetailSheet
        store={detailStore}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setDetailStore(null)
        }}
      />
    </div>
  )
}
