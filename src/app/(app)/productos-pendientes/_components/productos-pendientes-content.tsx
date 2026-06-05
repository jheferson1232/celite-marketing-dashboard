"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiSearchLine,
  RiStarLine,
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
  PendingProductRecord,
  PendingProductStatus,
} from "@/lib/services/product-pending/types"
import {
  addManualPendingProductAction,
  deletePendingProductAction,
  listPendingProductsAction,
  getSociaVaultSetupStatusAction,
  searchPendingProductSociaVaultAction,
} from "../_actions/pending-products"
import { PendingProductManualForm } from "./pending-product-manual-form"
import { PendingMatchGallery } from "./pending-match-gallery"

const STATUS_LABEL: Record<PendingProductStatus, string> = {
  IMPORTED: "Importado",
  SEARCHING: "Buscando",
  MATCHED: "Con resultados",
  NO_MATCH: "Sin coincidencias",
  ERROR: "Error",
}

function statusBadgeClass(status: PendingProductStatus): string {
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
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function isLegacyMetaNotice(message: string): boolean {
  return /Meta Ad Library|facebook-ad-library/i.test(message)
}

const SOCIAVAULT_KEY_ERROR_RE =
  /SOCIAVAULT_API_KEY es requerida/i

function noticeForDisplay(
  lastError: string | null,
  status: PendingProductStatus,
  sociavaultConfigured: boolean
): string | null {
  if (!lastError || isLegacyMetaNotice(lastError)) return null
  if (sociavaultConfigured && SOCIAVAULT_KEY_ERROR_RE.test(lastError)) {
    return "Pulsa «Buscar videos» de nuevo (la API key ya está en el servidor)."
  }
  return lastError
}

function showMatchCountsSummary(status: PendingProductStatus): boolean {
  return (
    status === "MATCHED" ||
    status === "NO_MATCH" ||
    status === "ERROR"
  )
}

function PendingProductRow({
  product,
  isSearchingSociaVault,
  isDeleting,
  onSearchSociaVault,
  onDelete,
  sociavaultConfigured,
}: {
  product: PendingProductRecord
  isSearchingSociaVault: boolean
  isDeleting: boolean
  onSearchSociaVault: () => void
  onDelete: () => void
  sociavaultConfigured: boolean
}) {
  const [open, setOpen] = useState(false)
  const tiktokVideos = product.matches
  const imageCount = product.imageUrls.length
  const isSearching = product.status === "SEARCHING" || isSearchingSociaVault
  const displayNotice = noticeForDisplay(
    product.lastError,
    product.status,
    sociavaultConfigured
  )

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="relative">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt=""
                className="size-12 rounded-md object-cover"
              />
            ) : (
              <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-md text-xs">
                N/A
              </div>
            )}
            {imageCount > 1 ? (
              <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                +{imageCount - 1}
              </span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="max-w-[280px]">
          <p className="font-medium leading-snug">{product.name}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Dropi #{product.dropiId}
          </p>
          {product.url ? (
            <a
              href={product.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary mt-1 inline-flex items-center gap-1 text-xs hover:underline"
            >
              Ver en Dropi
              <RiExternalLinkLine className="size-3" />
            </a>
          ) : null}
        </TableCell>
        <TableCell>
          <Badge
            variant="secondary"
            className={cn("font-normal", statusBadgeClass(product.status))}
          >
            {STATUS_LABEL[product.status]}
          </Badge>
          {showMatchCountsSummary(product.status) ? (
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              TikTok: {tiktokVideos.length}
            </p>
          ) : null}
          {displayNotice ? (
            <p
              className={cn(
                "mt-1 max-w-xs text-xs",
                product.status === "ERROR"
                  ? "text-destructive"
                  : "text-amber-600 dark:text-amber-500"
              )}
            >
              {displayNotice}
            </p>
          ) : null}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          <span className="block">{product.matches.length}</span>
          {product.matches.length > 0 ? (
            <span className="text-muted-foreground block text-[10px] font-normal">
              TikTok: {tiktokVideos.length}
            </span>
          ) : null}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {formatDate(product.lastSyncedAt)}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex flex-col items-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSearchSociaVault}
              disabled={isSearching}
            >
              <RiSearchLine
                className={cn("size-3.5", isSearching && "animate-spin")}
              />
              {isSearching ? "Buscando…" : "Buscar videos"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Ocultar" : "Ver"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isDeleting || isSearching}
              onClick={onDelete}
            >
              <RiDeleteBinLine className="size-3.5" />
              {isDeleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={6} className="max-w-0 overflow-visible py-4 pr-2">
            {product.imageUrls.length > 0 ? (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium">
                  Imágenes ({product.imageUrls.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.imageUrls.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={src}
                      src={src}
                      alt=""
                      className="size-16 rounded-md border object-cover"
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {product.matches.length > 0 ? (
              <PendingMatchGallery
                productId={product.id}
                title="Videos (TikTok)"
                items={tiktokVideos}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Sin coincidencias todavía. Usa Buscar videos.
              </p>
            )}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

export function ProductosPendientesContent({
  creditsHint,
}: {
  creditsHint: string
}) {
  const queryClient = useQueryClient()
  const [manualFormOpen, setManualFormOpen] = useState(false)

  const { data: products = [], isLoading, isError, error } = useQuery({
    queryKey: ["pending-products"],
    queryFn: () => runServerAction(listPendingProductsAction()),
    staleTime: 15 * 1000,
  })

  const { data: sociavaultSetup } = useQuery({
    queryKey: ["sociavault-setup"],
    queryFn: () => runServerAction(getSociaVaultSetupStatusAction()),
    staleTime: 60 * 1000,
  })

  const sociavaultConfigured = sociavaultSetup?.configured ?? true

  const addManualMutation = useMutation({
    mutationFn: async (values: { name: string; imageUrls: string[] }) => {
      return runServerAction(
        addManualPendingProductAction({
          name: values.name,
          imageUrls: values.imageUrls,
        })
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-products"] })
    },
  })

  const searchSociaVaultMutation = useMutation({
    mutationFn: (productId: string) =>
      runServerAction(searchPendingProductSociaVaultAction(productId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-products"] })
    },
  })

  const handleSearchSociaVault = (productId: string) => {
    if (searchSociaVaultMutation.isPending) return
    searchSociaVaultMutation.mutate(productId)
  }

  const deleteProductMutation = useMutation({
    mutationFn: (productId: string) =>
      runServerAction(deletePendingProductAction(productId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pending-products"] })
    },
  })

  const counts = useMemo(() => {
    const base = {
      total: products.length,
      matched: 0,
      noMatch: 0,
      error: 0,
    }
    for (const p of products) {
      if (p.status === "MATCHED") base.matched++
      else if (p.status === "NO_MATCH") base.noMatch++
      else if (p.status === "ERROR") base.error++
    }
    return base
  }, [products])

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <RiStarLine className="size-5" />
            <span className="text-xs font-medium uppercase tracking-wide">
              SociaVault
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Productos pendientes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Agrega productos manualmente y usa{" "}
            <strong className="text-foreground">Buscar videos</strong> en TikTok por
            cada uno. <strong className="text-foreground">{creditsHint}</strong>.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button
            type="button"
            variant="default"
            onClick={() => setManualFormOpen(true)}
            disabled={addManualMutation.isPending}
          >
            <RiAddLine className="size-4" />
            Agregar producto
          </Button>
        </div>
      </div>

      <PendingProductManualForm
        open={manualFormOpen}
        onOpenChange={setManualFormOpen}
        isPending={addManualMutation.isPending}
        onSubmit={async (values) => {
          await addManualMutation.mutateAsync(values)
        }}
      />

      {!sociavaultConfigured ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-medium">Falta SOCIAVAULT_API_KEY en Vercel</p>
          <p className="mt-1 text-destructive/90">
            En el proyecto de Vercel → Settings → Environment Variables, añade{" "}
            <code className="rounded bg-destructive/15 px-1">SOCIAVAULT_API_KEY</code>{" "}
            con tu clave <code className="rounded bg-destructive/15 px-1">sk_live_…</code>,
            marca <strong>Production</strong> y haz Redeploy. Luego pulsa «Buscar videos».
          </p>
        </div>
      ) : null}

      {searchSociaVaultMutation.isError ? (
        <p className="text-sm text-destructive">
          {searchSociaVaultMutation.error instanceof Error
            ? searchSociaVaultMutation.error.message
            : "No se pudo buscar en SociaVault."}
        </p>
      ) : null}

      <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
        <span>
          <strong className="text-foreground">{counts.total}</strong> productos
        </span>
        <span>
          <strong className="text-foreground">{counts.matched}</strong> con
          coincidencias
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
            : "No se pudieron cargar los productos pendientes."}
        </p>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <RiSearchLine className="mb-3 size-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">Aún no hay productos pendientes</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Pulsa <strong className="text-foreground">Agregar producto</strong> y
            luego busca videos en TikTok desde cada fila.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Img</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Matches</TableHead>
                <TableHead>Última sync</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <PendingProductRow
                  key={product.id}
                  product={product}
                  isSearchingSociaVault={
                    searchSociaVaultMutation.isPending &&
                    searchSociaVaultMutation.variables === product.id
                  }
                  isDeleting={
                    deleteProductMutation.isPending &&
                    deleteProductMutation.variables === product.id
                  }
                  onSearchSociaVault={() => handleSearchSociaVault(product.id)}
                  sociavaultConfigured={sociavaultConfigured}
                  onDelete={() => {
                    if (
                      !window.confirm(
                        `¿Eliminar "${product.name}" de la lista? Se borrarán también los videos encontrados.`
                      )
                    ) {
                      return
                    }
                    deleteProductMutation.mutate(product.id)
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
