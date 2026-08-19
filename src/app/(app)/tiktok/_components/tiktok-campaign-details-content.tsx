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
import {
  formatCurrency,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import { runServerAction } from "@/lib/server-action"
import { getLastSevenDaysRange } from "@/lib/services/tiktok/campaign-daily-insights.shared"
import { getTikTokCampaignDailyInsightsAction } from "../_actions/campaign-daily-insights"
import { getTikTokCampaignVideoThumbnailsAction } from "../_actions/campaign-video-thumbnails"
import { TikTokCampaignDetailsChart } from "./tiktok-campaign-details-chart"

interface TikTokCampaignDetailsContentProps {
  campaignId: string
  accountId?: string
  currency?: CurrencyCode
}

export function TikTokCampaignDetailsContent({
  campaignId,
  accountId,
  currency = TIKTOK_DASHBOARD_CURRENCY,
}: TikTokCampaignDetailsContentProps) {
  const dateRange = getLastSevenDaysRange()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      "tiktok-campaign-daily-insights",
      campaignId,
      accountId,
      dateRange,
    ],
    queryFn: () =>
      runServerAction(
        getTikTokCampaignDailyInsightsAction({
          campaignId,
          dateRange,
          accountId,
        })
      ),
    enabled: Boolean(campaignId),
  })

  const thumbnailsQuery = useQuery({
    queryKey: ["tiktok-campaign-video-thumbnails", campaignId, accountId],
    queryFn: () =>
      runServerAction(
        getTikTokCampaignVideoThumbnailsAction({ campaignId, accountId })
      ),
    enabled: Boolean(campaignId),
    staleTime: 5 * 60 * 1000,
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
          value={formatCurrency(data.totals.spend, currency)}
        />
        <SummaryCard
          label="Compras"
          value={String(data.totals.purchases)}
        />
        <SummaryCard
          label="CPA"
          value={
            data.totals.cpa > 0
              ? formatCurrency(data.totals.cpa, currency)
              : "—"
          }
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Gasto diario y compras</h3>
        <TikTokCampaignDetailsChart days={data.days} currency={currency} />
        <p className="text-muted-foreground mt-2 text-xs">
          Barras: gasto ({currency === "PEN" ? "S/" : "$"}) · Línea: compras
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
                      ? formatCurrency(day.spend, currency)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {day.purchases > 0 ? day.purchases : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {day.cpa > 0
                      ? formatCurrency(day.cpa, currency)
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
        {thumbnailsQuery.isLoading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] w-full rounded-md" />
            ))}
          </div>
        ) : thumbnailsQuery.isError ? (
          <p className="text-destructive text-xs">
            {thumbnailsQuery.error instanceof Error
              ? thumbnailsQuery.error.message
              : "No se pudieron cargar las miniaturas."}
          </p>
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
                    referrerPolicy="no-referrer"
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
