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
import { getMetaCampaignDailyInsightsAction } from "../../_actions/campaign-daily-insights"
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

  if (isLoading) {
    return (
      <div className="space-y-4 px-4 pb-6">
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
      <p className="px-4 pb-6 text-sm text-destructive">
        {error?.message ?? "No se pudieron cargar los detalles de la campaña."}
      </p>
    )
  }

  const rangeLabel = `${format(parseISO(dateRange.from), "d MMM", { locale: es })} – ${format(parseISO(dateRange.to), "d MMM yyyy", { locale: es })}`

  return (
    <div className="space-y-5 overflow-y-auto px-4 pb-6">
      <p className="text-xs text-muted-foreground">Últimos 7 días · {rangeLabel}</p>

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
        <p className="mt-2 text-xs text-muted-foreground">
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
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}
