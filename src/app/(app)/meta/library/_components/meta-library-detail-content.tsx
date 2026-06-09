"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { RiArrowLeftLine, RiMetaLine, RiRefreshLine } from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchMetaLibraryEntryDetailAction } from "../_actions/meta-library"
import { MetaLibraryAdCard } from "./meta-library-ad-card"
import { MetaLibraryDetailBreakdowns } from "./meta-library-detail-breakdowns"
import { MetaLibraryDetailSummary } from "./meta-library-detail-summary"

type AdFilter = "active" | "all"

export function MetaLibraryDetailContent({ entryId }: { entryId: string }) {
  const [filter, setFilter] = useState<AdFilter>("active")

  const detailQuery = useQuery({
    queryKey: ["meta-library-entry-detail", entryId],
    queryFn: () => runServerAction(fetchMetaLibraryEntryDetailAction(entryId)),
    staleTime: 5 * 60 * 1000,
  })

  const data = detailQuery.data
  const title =
    data?.company?.name ??
    data?.entry.facebookPage ??
    data?.domain ??
    "Detalle Meta Library"

  const visibleAds = useMemo(() => {
    if (!data) return []
    const source = filter === "active" ? data.ads : data.allAds
    return source
  }, [data, filter])

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-destructive">No se encontró la entrada.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/meta/library">Volver</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Link
            href="/meta/library"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <RiArrowLeftLine className="size-4" />
            Meta Library
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <RiMetaLine className="size-7 text-blue-600" />
            {title}
          </h1>
          {data.domain ? (
            <p className="text-muted-foreground text-sm">{data.domain}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={detailQuery.isFetching}
          onClick={() => void detailQuery.refetch()}
        >
          <RiRefreshLine className="size-4" />
          Actualizar
        </Button>
      </div>

      {data.warning ? (
        <p className="text-sm text-amber-600 dark:text-amber-500">{data.warning}</p>
      ) : null}

      <MetaLibraryDetailSummary
        activeCount={data.activeCount}
        totalCount={data.totalCount}
        analytics={data.analytics}
      />

      <MetaLibraryDetailBreakdowns
        analytics={data.analytics}
        domain={data.domain}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Anuncios</h2>
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as AdFilter)}
          >
            <TabsList>
              <TabsTrigger value="active">
                Activos ({data.activeCount})
              </TabsTrigger>
              <TabsTrigger value="all">Todos ({data.allAds.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {visibleAds.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleAds.map((ad) => (
              <MetaLibraryAdCard key={ad.adArchiveId} ad={ad} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
            No hay anuncios para este filtro.
          </p>
        )}
      </section>

      {data.analytics.topByDuration.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Top por mayor duración</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.analytics.topByDuration.slice(0, 4).map((ad, index) => (
              <div key={ad.adArchiveId} className="relative">
                <span className="absolute top-2 left-2 z-10 rounded-md bg-background/90 px-2 py-0.5 text-xs font-bold shadow">
                  #{index + 1}
                </span>
                <MetaLibraryAdCard ad={ad} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
