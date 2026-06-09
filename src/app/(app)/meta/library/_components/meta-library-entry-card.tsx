"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useQuery } from "@tanstack/react-query"
import {
  RiAdvertisementLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiEyeLine,
  RiFacebookCircleFill,
  RiGlobalLine,
  RiGroupLine,
  RiPencilLine,
  RiPlayFill,
  RiRefreshLine,
  RiThumbUpLine,
} from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { MetaLibraryEntryRecord } from "@/lib/services/meta/library/meta-library-entries"
import type { MetaLibraryPreviewSlide } from "@/lib/services/meta/library/meta-library-ads"
import { facebookPageProfileUrl } from "@/lib/services/meta/library/meta-library-links"
import {
  fetchMetaLibraryEntryAdsAction,
  getMetaLibraryEntryStorePreviewAction,
  syncMetaLibraryEntrySociaVaultAction,
} from "../_actions/meta-library"

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(price)
  } catch {
    return `$${price}`
  }
}

function storeSlidesFromPreview(
  images: string[],
  title: string | null
): MetaLibraryPreviewSlide[] {
  return images.map((imageUrl, index) => ({
    imageUrl,
    videoUrl: null,
    title: index === 0 ? title : null,
    isActive: true,
  }))
}

export function MetaLibraryEntryCard({
  entry,
  onEdit,
  onDelete,
  deleting,
}: {
  entry: MetaLibraryEntryRecord
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const [slide, setSlide] = useState(0)

  const storeQuery = useQuery({
    queryKey: ["meta-library-store-preview", entry.id],
    queryFn: () => runServerAction(getMetaLibraryEntryStorePreviewAction(entry.id)),
    enabled: Boolean(entry.url),
    staleTime: 30 * 60 * 1000,
  })

  const adsQuery = useQuery({
    queryKey: ["meta-library-entry-ads", entry.id],
    queryFn: () => runServerAction(fetchMetaLibraryEntryAdsAction(entry.id)),
    staleTime: 5 * 60 * 1000,
  })

  const fetchAds = () => {
    void runServerAction(syncMetaLibraryEntrySociaVaultAction(entry.id)).then(() => {
      void adsQuery.refetch()
    })
  }
  const isPendingAds = adsQuery.isFetching && !adsQuery.isFetched

  const company = adsQuery.data?.company
  const activeCount = adsQuery.data?.activeCount ?? 0
  const totalCount = adsQuery.data?.totalCount ?? 0
  const domain =
    adsQuery.data?.domain ??
    (entry.url
      ? (() => {
          try {
            return new URL(
              entry.url.startsWith("http") ? entry.url : `https://${entry.url}`
            ).hostname.replace(/^www\./i, "")
          } catch {
            return null
          }
        })()
      : null)
  const warning = adsQuery.data?.warning
  const ads = adsQuery.data?.ads ?? []

  const slides = useMemo(() => {
    const adSlides = adsQuery.data?.previewSlides ?? []
    if (adSlides.length > 0) return adSlides

    const store = storeQuery.data
    if (store?.images.length) {
      return storeSlidesFromPreview(store.images, store.title)
    }

    return []
  }, [adsQuery.data?.previewSlides, storeQuery.data])

  const currentSlide = slides[slide] ?? null
  const hasThumbnail = Boolean(currentSlide?.imageUrl)

  const title =
    ads[0]?.title ??
    storeQuery.data?.title ??
    company?.name ??
    entry.facebookPage ??
    domain ??
    "Sin título"

  const storeHref = entry.url ?? (domain ? `https://${domain}` : null)
  const facebookPageHref = facebookPageProfileUrl({
    facebookPage: entry.facebookPage,
    pageId: company?.pageId,
  })
  const publishedLabel = storeQuery.data?.publishedAt
    ? format(new Date(storeQuery.data.publishedAt), "d MMM yyyy", { locale: es })
    : format(new Date(entry.createdAt), "d MMM yyyy", { locale: es })

  return (
    <article className="rounded-2xl border bg-card shadow-sm">
      <div className="grid gap-4 p-4 lg:grid-cols-[160px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-6 lg:p-5">
        <div className="relative mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-xl bg-muted">
          {storeQuery.isLoading && !hasThumbnail ? (
            <Skeleton className="size-full" />
          ) : hasThumbnail && currentSlide ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentSlide.imageUrl}
                alt={currentSlide.title ?? "Vista previa"}
                className="size-full object-cover"
              />
              {currentSlide.videoUrl ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <RiPlayFill className="size-10 text-white drop-shadow" />
                </div>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              onClick={fetchAds}
              disabled={adsQuery.isFetching}
              className="text-muted-foreground hover:text-foreground flex size-full flex-col items-center justify-center gap-2 px-3 text-center transition-colors disabled:opacity-60"
              aria-label="Consultar SociaVault"
            >
              <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
                {adsQuery.isFetching ? (
                  <RiRefreshLine className="size-6 animate-spin" />
                ) : (
                  <RiPlayFill className="size-6" />
                )}
              </span>
              <span className="text-xs">Consultar anuncios</span>
            </button>
          )}

          {slides.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-background/90 p-1 shadow"
                onClick={() =>
                  setSlide((prev) => (prev - 1 + slides.length) % slides.length)
                }
                aria-label="Anterior"
              >
                <RiArrowLeftSLine className="size-4" />
              </button>
              <button
                type="button"
                className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full bg-background/90 p-1 shadow"
                onClick={() => setSlide((prev) => (prev + 1) % slides.length)}
                aria-label="Siguiente"
              >
                <RiArrowRightSLine className="size-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {slides.map((_, index) => (
                  <span
                    key={index}
                    className={`size-1.5 rounded-full ${
                      index === slide ? "bg-primary" : "bg-background/70"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="min-w-0 space-y-2 border-b pb-4 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
          <h2 className="line-clamp-2 text-base font-semibold leading-snug">{title}</h2>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <RiCalendarLine className="size-3.5 shrink-0" />
            Publicado el {publishedLabel}
          </p>
          {storeQuery.data?.price != null ? (
            <p className="text-xl font-bold tracking-tight">
              {formatPrice(
                storeQuery.data.price,
                storeQuery.data.currency ?? "USD"
              )}
            </p>
          ) : storeQuery.isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : null}
          {storeHref ? (
            <a
              href={storeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
            >
              {domain ?? storeHref}
              <RiExternalLinkLine className="size-3.5 shrink-0" />
            </a>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={`/meta/library/${entry.id}`}>
                <RiEyeLine className="size-4" />
                Ver anuncios
              </Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
              <RiPencilLine className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleting}
              onClick={onDelete}
            >
              <RiDeleteBinLine className="size-4" />
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-2 border-b pb-4 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
          <h3 className="text-sm font-medium">Información de la tienda</h3>
          {storeQuery.isLoading && !adsQuery.isFetched ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <RiCalendarLine className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <dt className="text-muted-foreground text-xs">Agregada</dt>
                  <dd>
                    {format(new Date(entry.createdAt), "d MMM yyyy", { locale: es })}
                  </dd>
                </div>
              </div>
              {entry.facebookPage ? (
                <div className="flex items-start gap-2">
                  <RiGlobalLine className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-muted-foreground text-xs">Página Meta</dt>
                    <dd className="truncate">{entry.facebookPage}</dd>
                  </div>
                </div>
              ) : !adsQuery.isFetched ? (
                <p className="text-muted-foreground text-xs">
                  Pulsa play en anuncios para datos de la página en SociaVault.
                </p>
              ) : null}
              {company?.name ? (
                <div className="flex items-start gap-2">
                  <RiGroupLine className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <dt className="text-muted-foreground text-xs">Nombre en Meta</dt>
                    <dd className="truncate">{company.name}</dd>
                  </div>
                </div>
              ) : null}
              {company?.category ? (
                <div className="flex items-start gap-2">
                  <RiGroupLine className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <dt className="text-muted-foreground text-xs">Categoría</dt>
                    <dd>{company.category}</dd>
                  </div>
                </div>
              ) : null}
              {company?.likes != null ? (
                <div className="flex items-start gap-2">
                  <RiThumbUpLine className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <dt className="text-muted-foreground text-xs">Me gusta</dt>
                    <dd>{formatCount(company.likes)}</dd>
                  </div>
                </div>
              ) : null}
            </dl>
          )}
          {facebookPageHref ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" asChild>
                <a
                  href={facebookPageHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <RiFacebookCircleFill className="size-4 text-blue-600" />
                  Facebook
                  <RiExternalLinkLine className="size-3.5 opacity-60" />
                </a>
              </Button>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium">Anuncios</h3>
            {adsQuery.isFetched ? (
              <p className="flex items-center gap-1 text-xs">
                <RiAdvertisementLine className="size-3.5 text-emerald-600" />
                <span className="font-semibold text-emerald-600">
                  {activeCount} activos
                </span>
                <span className="text-muted-foreground">
                  / {totalCount} totales
                </span>
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                disabled={adsQuery.isFetching}
                onClick={fetchAds}
              >
                {adsQuery.isFetching ? (
                  <RiRefreshLine className="size-3.5 animate-spin" />
                ) : (
                  <RiPlayFill className="size-3.5" />
                )}
                SociaVault
              </Button>
            )}
          </div>

          {isPendingAds ? (
            <div className="flex gap-2">
              <Skeleton className="size-20 rounded-lg" />
              <Skeleton className="size-20 rounded-lg" />
              <Skeleton className="size-20 rounded-lg" />
            </div>
          ) : adsQuery.isFetched && ads.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {ads.slice(0, 3).map((ad) => (
                <a
                  key={ad.adArchiveId}
                  href={
                    ad.linkUrl ??
                    `https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted"
                  title={ad.title ?? "Ver anuncio"}
                >
                  {ad.imageUrl ?? ad.videoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ad.imageUrl ?? ad.videoPreviewUrl ?? ""}
                      alt={ad.title ?? "Anuncio"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
                      Sin imagen
                    </div>
                  )}
                  {ad.videoUrl ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <RiPlayFill className="size-6 text-white" />
                    </div>
                  ) : null}
                </a>
              ))}
            </div>
          ) : adsQuery.isFetched ? (
            <p className="text-muted-foreground text-xs">
              No se encontraron anuncios activos para esta entrada.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Consulta SociaVault para ver creativos y conteos.
            </p>
          )}

          {warning ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">{warning}</p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
