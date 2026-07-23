"use client"

import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, META_DASHBOARD_CURRENCY } from "@/lib/format"
import { runServerAction } from "@/lib/server-action"
import { getLastSevenDaysRange } from "@/lib/services/meta/campaign-daily-insights"
import { isMetaRateLimitError } from "@/lib/services/meta/meta-errors"
import { getMetaCampaignDailyInsightsAction } from "../../_actions/campaign-daily-insights"
import { getMetaCampaignVideoThumbnailsAction } from "../../_actions/campaign-video-thumbnails"
import { TikTokCampaignDetailsChart } from "@/app/(app)/tiktok/_components/tiktok-campaign-details-chart"

interface MetaCampaignDetailsContentProps {
  campaignId: string
  objective: string
}

export function MetaCampaignDetailsContent({
  campaignId,
  objective,
}: MetaCampaignDetailsContentProps) {
  const dateRange = getLastSevenDaysRange()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "meta-campaign-daily-insights",
      campaignId,
      dateRange,
      objective,
    ],
    queryFn: () =>
      runServerAction(
        getMetaCampaignDailyInsightsAction({
          campaignId,
          dateRange,
          objective,
        })
      ),
    enabled: Boolean(campaignId),
  })

  // Diferir miniaturas hasta que los insights terminen: evita pico de QPS con Meta.
  const thumbnailsQuery = useQuery({
    queryKey: ["meta-campaign-video-thumbnails", campaignId],
    queryFn: () =>
      runServerAction(getMetaCampaignVideoThumbnailsAction(campaignId)),
    enabled: Boolean(campaignId) && Boolean(data),
    staleTime: 30 * 60 * 1000,
    retry: (failureCount, error) =>
      isMetaRateLimitError(error) ? failureCount < 2 : failureCount < 1,
    retryDelay: (attempt) => Math.min(2_000 * 2 ** attempt, 8_000),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-6">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="aspect-[16/9] w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <p className="text-destructive px-4 pb-6 text-sm">
        {error?.message ?? "No se pudieron cargar los detalles de la campaña."}
      </p>
    )
  }

  const rangeLabel = `${format(parseISO(dateRange.from), "d MMM", { locale: es })} – ${format(parseISO(dateRange.to), "d MMM yyyy", { locale: es })}`
  const thumbnails = thumbnailsQuery.data ?? []

  return (
    <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
      <p className="text-muted-foreground text-xs">
        Últimos 7 días · {rangeLabel}
      </p>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Gasto total"
          value={formatCurrency(data.totals.spend, META_DASHBOARD_CURRENCY)}
        />
        <SummaryCard
          label="Compras"
          value={String(data.totals.purchases)}
        />
        <SummaryCard
          label="CPA"
          value={
            data.totals.cpa > 0
              ? formatCurrency(data.totals.cpa, META_DASHBOARD_CURRENCY)
              : "—"
          }
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Gasto diario y compras</h3>
        <TikTokCampaignDetailsChart
          days={data.days}
          currency={META_DASHBOARD_CURRENCY}
        />
        <p className="text-muted-foreground mt-2 text-xs">
          Barras: gasto ($) · Línea: compras
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Detalle por día</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Día</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">CPA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.days].reverse().map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="font-medium">
                    {format(parseISO(day.date), "EEE d MMM", { locale: es })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {day.spend > 0
                      ? formatCurrency(day.spend, META_DASHBOARD_CURRENCY)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {day.purchases > 0 ? day.purchases : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {day.cpa > 0
                      ? formatCurrency(day.cpa, META_DASHBOARD_CURRENCY)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Videos de la campaña</h3>
        <p className="text-muted-foreground mb-3 text-xs">
          Miniaturas (solo covers, sin cargar el video).
        </p>
        {thumbnailsQuery.isLoading || thumbnailsQuery.isFetching ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] w-full rounded-md" />
            ))}
          </div>
        ) : thumbnailsQuery.isError ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs">
              {isMetaRateLimitError(thumbnailsQuery.error)
                ? "Meta limitó las llamadas. Espera unos segundos y reintenta."
                : thumbnailsQuery.error instanceof Error
                  ? thumbnailsQuery.error.message
                  : "No se pudieron cargar las miniaturas."}
            </p>
            <button
              type="button"
              className="text-foreground w-fit text-xs underline underline-offset-2"
              onClick={() => void thumbnailsQuery.refetch()}
            >
              Reintentar
            </button>
          </div>
        ) : thumbnails.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No hay creativos con miniatura en esta campaña.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {thumbnails.map((item) => (
              <li key={item.id} className="min-w-0">
                <div className="bg-muted overflow-hidden rounded-md border">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.name}
                    title={item.name}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[9/16] w-full object-cover"
                  />
                </div>
                <p className="text-muted-foreground mt-1 truncate text-[10px]">
                  {item.name}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}
