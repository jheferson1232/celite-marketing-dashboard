"use client"

import { useQuery } from "@tanstack/react-query"
import {
  RiExternalLinkLine,
  RiMetaLine,
  RiPlayCircleLine,
} from "@remixicon/react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import type { StorePendingRecord } from "@/lib/services/store-pending/types"
import { getStorePendingDetailAction } from "../_actions/pending-stores"

interface StorePendingDetailSheetProps {
  store: StorePendingRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(date: Date | string | null): string {
  if (!date) return "—"
  const value = typeof date === "string" ? new Date(date) : date
  return value.toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function StorePendingDetailSheet({
  store,
  open,
  onOpenChange,
}: StorePendingDetailSheetProps) {
  const storeId = store?.id ?? null

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["store-pending-detail", storeId],
    queryFn: () => runServerAction(getStorePendingDetailAction(storeId!)),
    enabled: open && Boolean(storeId),
    staleTime: 30_000,
  })

  const latest = data?.latestSnapshot ?? store?.latestSnapshot ?? null
  const creatives = data?.creatives ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="pr-8">{store?.name ?? "Tienda"}</SheetTitle>
          <SheetDescription>
            Vista general de anuncios Meta scrapeados con SocialVault
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "No se pudo cargar el detalle de la tienda."}
            </p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                {store?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={store.logoUrl}
                    alt=""
                    className="size-12 rounded-lg border object-cover"
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-lg">
                    <RiMetaLine className="size-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium">{store?.name}</p>
                  {store?.domain ? (
                    <a
                      href={store.pageUrl ?? `https://${store.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                    >
                      {store.domain}
                      <RiExternalLinkLine className="size-3.5" />
                    </a>
                  ) : null}
                  <p className="text-muted-foreground mt-1 text-xs">
                    Creada el {formatDate(store?.createdAt ?? null)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricCard
                  label="Activos"
                  value={String(latest?.activeAds ?? store?.activeCreativeCount ?? 0)}
                />
                <MetricCard
                  label="Total"
                  value={String(latest?.totalAds ?? store?.creativeCount ?? 0)}
                />
                <MetricCard
                  label="Guardados"
                  value={String(latest?.creativesSaved ?? creatives.length)}
                />
                <MetricCard
                  label="País"
                  value={store?.country ?? "ALL"}
                />
              </div>

              <section>
                <h3 className="mb-3 text-sm font-medium">
                  Top anuncios ({creatives.length})
                </h3>
                {creatives.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Sin creativos guardados. Usa «Scrapear Meta» en la tabla.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {creatives.slice(0, 10).map((creative) => (
                      <article
                        key={creative.id}
                        className="overflow-hidden rounded-lg border"
                      >
                        <div className="relative aspect-video bg-muted">
                          {creative.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={creative.previewUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                              Sin preview
                            </div>
                          )}
                          {creative.mediaType === "video" ? (
                            <RiPlayCircleLine className="absolute inset-0 m-auto size-10 text-white/90" />
                          ) : null}
                        </div>
                        <div className="space-y-2 p-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={
                                creative.isActive
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                  : ""
                              }
                            >
                              {creative.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                            {creative.mediaType ? (
                              <span className="text-muted-foreground text-xs capitalize">
                                {creative.mediaType}
                              </span>
                            ) : null}
                          </div>
                          <p className="line-clamp-2 text-sm font-medium">
                            {creative.title ?? "Sin título"}
                          </p>
                          {creative.landingUrl ? (
                            <a
                              href={creative.landingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary line-clamp-1 text-xs hover:underline"
                            >
                              {creative.landingUrl}
                            </a>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {data?.snapshots && data.snapshots.length > 0 ? (
                <section>
                  <h3 className="mb-3 text-sm font-medium">Historial de scrapes</h3>
                  <div className="space-y-2">
                    {data.snapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <span>{formatDate(snapshot.createdAt)}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {snapshot.activeAds} activos / {snapshot.totalAds} total
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
