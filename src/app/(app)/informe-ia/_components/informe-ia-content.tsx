"use client"

import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiBrainLine,
  RiRefreshLine,
  RiStackLine,
} from "@remixicon/react"
import { MetaConfigErrorHint } from "@/components/meta-config-error-hint"
import { MetaApiStatusIndicator } from "@/components/meta-api-status-indicator"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatCurrency, META_DASHBOARD_CURRENCY } from "@/lib/format"
import { getMetaInformeApiStatus } from "@/lib/meta-api-status"
import { isMetaConfigError } from "@/lib/services/meta/meta-errors"
import { runServerAction } from "@/lib/server-action"
import {
  formatNumber,
  getCostPerResultCellClassName,
} from "@/app/(app)/dashboard/_components/campaigns/utils"
import type {
  InformeCampaignGroup,
  InformeEntityRow,
  InformeTableTotals,
} from "@/lib/services/meta/meta-operative-service"
import type { InformePauseItem } from "@/lib/services/meta/meta-informe-alerts"
import {
  getMetaInformeAction,
  previewMetaInformeHourlyAction,
  sendMetaInformeHourlyToTelegramAction,
  syncMetaInformeAction,
} from "../_actions/meta-informe"

function formatDayLabel(date: string): string {
  const [, m, d] = date.split("-")
  return `${d}/${m}`
}

/** Fecha completa para columnas ayer/hoy (ej. 21/05/2026). */
function formatInformeDate(date: string): string {
  const [y, m, d] = date.split("-")
  if (!y || !m || !d) return date
  return `${d}/${m}/${y}`
}

function PauseAlertsBanner({
  title,
  items,
  variant,
}: {
  title: string
  items: InformePauseItem[]
  variant: "amber" | "red"
}) {
  if (items.length === 0) return null
  const border =
    variant === "amber"
      ? "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10"
      : "border-red-200 bg-red-50/80 dark:border-red-500/30 dark:bg-red-500/10"
  const titleColor =
    variant === "amber"
      ? "text-amber-800 dark:text-amber-300"
      : "text-red-800 dark:text-red-300"
  const iconColor = variant === "amber" ? "text-amber-600" : "text-red-600"

  return (
    <div className={cn("flex gap-2 rounded-lg border px-4 py-3 text-sm", border)}>
      <RiAlertLine className={cn("mt-0.5 size-4 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", titleColor)}>{title}</p>
        <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
          {items.slice(0, 6).map((item) => (
            <li key={`${item.type}-${item.name}`} className="truncate">
              {item.type === "adset" && item.campaignName
                ? `${item.name} (${item.campaignName})`
                : item.name}
              {" · "}
              {formatCurrency(item.spend, META_DASHBOARD_CURRENCY)} ·{" "}
              {item.purchases} compras
            </li>
          ))}
          {items.length > 6 ? (
            <li className="text-muted-foreground/80">
              +{items.length - 6} más en el informe de Telegram
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

type PeriodMetrics = {
  spend: number
  purchases: number
  cpa: number
}

function getYesterdayMetrics(
  row: InformeEntityRow,
  yesterday: string
): PeriodMetrics {
  const yCell = row.dayCells.find((d) => d.date === yesterday)
  const spend = yCell?.spend ?? 0
  const purchases = yCell?.purchases ?? 0
  return {
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
  }
}

function getTodayMetrics(row: InformeEntityRow): PeriodMetrics {
  return {
    spend: row.spendToday,
    purchases: row.purchasesToday,
    cpa: row.cpaToday,
  }
}

function getDayTotalsMetrics(
  totals: InformeTableTotals,
  date: string
): PeriodMetrics {
  const day = totals.dayTotals.find((d) => d.date === date)
  const spend = day?.spend ?? 0
  const purchases = day?.purchases ?? 0
  return {
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
  }
}

function PeriodMetricsCells({
  metrics,
  periodLabel,
  highlightCpa = true,
}: {
  metrics: PeriodMetrics
  periodLabel: string
  /** En fila total no colorear CPA (evita celdas rojas/naranjas confusas). */
  highlightCpa?: boolean
}) {
  const cpaHighlight = highlightCpa
    ? getCostPerResultCellClassName(metrics.cpa, META_DASHBOARD_CURRENCY)
    : ""

  return (
    <>
      <TableCell
        className="text-right tabular-nums"
        title={`Gasto ${periodLabel}`}
      >
        {metrics.spend > 0
          ? formatCurrency(metrics.spend, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
      <TableCell
        className="text-right tabular-nums"
        title={`Compras ${periodLabel}`}
      >
        {metrics.purchases > 0 ? formatNumber(metrics.purchases) : "—"}
      </TableCell>
      <TableCell
        className={cn("text-right tabular-nums", cpaHighlight)}
        title={`CPA ${periodLabel}`}
      >
        {metrics.cpa > 0
          ? formatCurrency(metrics.cpa, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
    </>
  )
}

function MetricsCells({
  row,
  yesterday,
  today,
}: {
  row: InformeEntityRow
  yesterday: string
  today: string
}) {
  return (
    <>
      <PeriodMetricsCells
        metrics={getYesterdayMetrics(row, yesterday)}
        periodLabel={formatInformeDate(yesterday)}
      />
      <PeriodMetricsCells
        metrics={getTodayMetrics(row)}
        periodLabel={formatInformeDate(today)}
      />
    </>
  )
}

function InformeAccountSummary({
  totals,
  yesterday,
  today,
  informeStartDate,
  dateRange,
}: {
  totals: InformeTableTotals
  yesterday: string
  today: string
  informeStartDate: string
  dateRange: { from: string; to: string }
}) {
  const ayer = getDayTotalsMetrics(totals, yesterday)
  const hoy = getTodayMetricsFromTotals(totals)

  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
      <p>
        <strong className="text-foreground font-medium">
          {formatInformeDate(yesterday)}:
        </strong>{" "}
        gasto {formatCurrency(ayer.spend, META_DASHBOARD_CURRENCY)} ·{" "}
        {formatNumber(ayer.purchases)} compras
        {ayer.cpa > 0
          ? ` · CPA ${formatCurrency(ayer.cpa, META_DASHBOARD_CURRENCY)}`
          : ""}
      </p>
      <p>
        <strong className="text-foreground font-medium">
          {formatInformeDate(today)}:
        </strong>{" "}
        gasto {formatCurrency(hoy.spend, META_DASHBOARD_CURRENCY)} ·{" "}
        {formatNumber(hoy.purchases)} compras
        {hoy.cpa > 0
          ? ` · CPA ${formatCurrency(hoy.cpa, META_DASHBOARD_CURRENCY)}`
          : ""}
      </p>
      <p className="text-xs sm:basis-full">
        Informe desde {formatDayLabel(informeStartDate)}
        {dateRange.from !== dateRange.to
          ? ` · historial ${formatDayLabel(dateRange.from)} → ${formatDayLabel(dateRange.to)}`
          : ""}
      </p>
    </div>
  )
}

function getTodayMetricsFromTotals(totals: InformeTableTotals): PeriodMetrics {
  return {
    spend: totals.spendToday,
    purchases: totals.purchasesToday,
    cpa: totals.cpaToday,
  }
}

function AdsetCountCells({
  adSetsCount,
  activeAdSetsCount,
}: {
  adSetsCount?: number
  activeAdSetsCount?: number
}) {
  if (adSetsCount === undefined || activeAdSetsCount === undefined) {
    return (
      <>
        <TableCell className="text-center text-muted-foreground">—</TableCell>
        <TableCell className="text-center text-muted-foreground">—</TableCell>
      </>
    )
  }

  return (
    <>
      <TableCell className="text-center tabular-nums">{adSetsCount}</TableCell>
      <TableCell className="text-center tabular-nums">
        <span
          className={cn(
            activeAdSetsCount > 0 && "font-medium text-orange-500"
          )}
        >
          {activeAdSetsCount}
        </span>
      </TableCell>
    </>
  )
}

function StatusCells({ row }: { row: InformeEntityRow }) {
  return (
    <>
      <TableCell className="w-[72px] text-center">
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            row.metaWasActive
              ? "bg-green-100 text-green-800 dark:bg-green-500/25 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-500/25 dark:text-red-300"
          )}
        >
          {row.metaWasActive ? "ON" : "OFF"}
        </span>
      </TableCell>
      <TableCell
        className={cn(
          "min-w-[140px] text-center text-xs",
          row.rowHighlight === "red" &&
            "font-medium text-red-600 dark:text-red-400"
        )}
      >
        {row.estadoLabel}
      </TableCell>
    </>
  )
}

function EntityRow({
  row,
  yesterday,
  today,
  indent,
  leadingCell,
  adSetsCount,
  activeAdSetsCount,
}: {
  row: InformeEntityRow
  yesterday: string
  today: string
  indent?: boolean
  leadingCell?: React.ReactNode
  adSetsCount?: number
  activeAdSetsCount?: number
}) {
  return (
    <TableRow className={cn(indent && "bg-muted/20")}>
      <TableCell className={cn("max-w-[260px]", indent && "pl-10")}>
        <div className="flex items-center gap-2">
          {leadingCell}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium leading-tight">{row.name}</span>
            <span className="text-muted-foreground text-xs">
              {row.type === "campaign" ? "Campaña" : "Conjunto"}
            </span>
          </div>
        </div>
      </TableCell>
      <StatusCells row={row} />
      <AdsetCountCells
        adSetsCount={adSetsCount}
        activeAdSetsCount={activeAdSetsCount}
      />
      <MetricsCells row={row} yesterday={yesterday} today={today} />
    </TableRow>
  )
}

function CampaignGroupRows({
  group,
  isExpanded,
  onToggleExpand,
  yesterday,
  today,
}: {
  group: InformeCampaignGroup
  isExpanded: boolean
  onToggleExpand: () => void
  yesterday: string
  today: string
}) {
  const adsetCount = group.adsets.length

  return (
    <>
      <EntityRow
        row={group.campaign}
        yesterday={yesterday}
        today={today}
        adSetsCount={group.adSetsCount}
        activeAdSetsCount={group.activeAdSetsCount}
        leadingCell={
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-7 shrink-0"
              onClick={onToggleExpand}
              disabled={adsetCount === 0}
              aria-expanded={isExpanded}
              aria-label={
                isExpanded
                  ? "Ocultar conjuntos de la campaña"
                  : "Ver conjuntos de la campaña"
              }
              title={
                adsetCount === 0
                  ? "Sin conjuntos con gasto hoy"
                  : isExpanded
                    ? "Ocultar conjuntos"
                    : `Ver ${adsetCount} conjunto${adsetCount === 1 ? "" : "s"}`
              }
            >
              {adsetCount === 0 ? (
                <RiStackLine className="size-4 opacity-40" />
              ) : isExpanded ? (
                <RiArrowDownSLine className="size-4" />
              ) : (
                <RiArrowRightSLine className="size-4" />
              )}
            </Button>
          </div>
        }
      />
      {isExpanded
        ? group.adsets.map((adset) => (
            <EntityRow
              key={adset.entityId}
              row={adset}
              yesterday={yesterday}
              today={today}
              indent
            />
          ))
        : null}
    </>
  )
}

function InformeTotalsRow({
  totals,
  yesterday,
  today,
}: {
  totals: InformeTableTotals
  yesterday: string
  today: string
}) {
  const ayer = getDayTotalsMetrics(totals, yesterday)
  const hoy = getTodayMetricsFromTotals(totals)

  return (
    <TableRow className="bg-muted/60 border-t-2 font-semibold">
      <TableCell colSpan={5} className="text-left">
        Total (conjuntos)
      </TableCell>
      <PeriodMetricsCells
        metrics={ayer}
        periodLabel={formatInformeDate(yesterday)}
        highlightCpa={false}
      />
      <PeriodMetricsCells
        metrics={hoy}
        periodLabel={formatInformeDate(today)}
        highlightCpa={false}
      />
    </TableRow>
  )
}

function InformeTable({
  groups,
  yesterday,
  today,
  totals,
}: {
  groups: InformeCampaignGroup[]
  yesterday: string
  today: string
  totals: InformeTableTotals
}) {
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<Set<string>>(
    () => new Set()
  )

  const handleToggleExpand = useCallback((campaignMetaId: string) => {
    setExpandedCampaignIds((current) => {
      const next = new Set(current)
      if (next.has(campaignMetaId)) {
        next.delete(campaignMetaId)
      } else {
        next.add(campaignMetaId)
      }
      return next
    })
  }, [])

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[220px]" rowSpan={2}>
            Nombre
          </TableHead>
          <TableHead className="text-center" rowSpan={2}>
            Meta
          </TableHead>
          <TableHead className="text-center" rowSpan={2}>
            Estado
          </TableHead>
          <TableHead className="text-center" rowSpan={2}>
            Conjuntos
          </TableHead>
          <TableHead className="text-center" rowSpan={2}>
            Conj. activos
          </TableHead>
          <TableHead
            colSpan={3}
            className="border-border bg-muted/40 text-center text-xs font-semibold tabular-nums"
          >
            {formatInformeDate(yesterday)}
          </TableHead>
          <TableHead
            colSpan={3}
            className="border-border bg-muted/20 text-center text-xs font-semibold tabular-nums"
          >
            {formatInformeDate(today)}
          </TableHead>
        </TableRow>
        <TableRow>
          <TableHead className="bg-muted/40 text-right text-xs">Gasto</TableHead>
          <TableHead className="bg-muted/40 text-right text-xs">
            Compras
          </TableHead>
          <TableHead className="bg-muted/40 text-right text-xs">CPA</TableHead>
          <TableHead className="bg-muted/20 text-right text-xs">Gasto</TableHead>
          <TableHead className="bg-muted/20 text-right text-xs">
            Compras
          </TableHead>
          <TableHead className="bg-muted/20 text-right text-xs">CPA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <CampaignGroupRows
            key={group.campaign.entityId}
            group={group}
            isExpanded={expandedCampaignIds.has(group.campaign.metaId)}
            onToggleExpand={() => handleToggleExpand(group.campaign.metaId)}
            yesterday={yesterday}
            today={today}
          />
        ))}
      </TableBody>
      <TableFooter>
        <InformeTotalsRow
          totals={totals}
          yesterday={yesterday}
          today={today}
        />
      </TableFooter>
    </Table>
  )
}

function getHourlyMutationError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return "No se pudo generar el informe. Revisa Meta, la base de datos y las variables en Vercel."
}

export function InformeIaContent() {
  const queryClient = useQueryClient()
  const [aiText, setAiText] = useState<string | null>(null)
  const [telegramSent, setTelegramSent] = useState<number | null>(null)
  const [hourlyError, setHourlyError] = useState<string | null>(null)

  const informeQuery = useQuery({
    queryKey: ["meta-informe-ia"],
    queryFn: () => runServerAction(getMetaInformeAction()),
    staleTime: 2 * 60 * 1000,
  })

  const syncMutation = useMutation({
    mutationFn: () => runServerAction(syncMetaInformeAction()),
    onSuccess: (data) => {
      queryClient.setQueryData(["meta-informe-ia"], data)
    },
  })

  const previewMutation = useMutation({
    mutationFn: () => runServerAction(previewMetaInformeHourlyAction()),
    onMutate: () => {
      setHourlyError(null)
    },
    onSuccess: (result) => {
      if (!result) return
      setAiText(result.text)
      setTelegramSent(null)
    },
    onError: (error) => {
      setHourlyError(getHourlyMutationError(error))
      setAiText(null)
      setTelegramSent(null)
    },
  })

  const sendMutation = useMutation({
    mutationFn: () => runServerAction(sendMetaInformeHourlyToTelegramAction()),
    onMutate: () => {
      setHourlyError(null)
    },
    onSuccess: (result) => {
      if (!result) return
      setAiText(result.text)
      setTelegramSent(result.sent)
    },
    onError: (error) => {
      setHourlyError(getHourlyMutationError(error))
    },
  })

  const hourlyPending = previewMutation.isPending || sendMutation.isPending
  const hourlyLoadingLabel = previewMutation.isPending
    ? "Generando vista previa…"
    : sendMutation.isPending
      ? "Generando y enviando a Telegram…"
      : null

  const data = informeQuery.data
  const pending = syncMutation.isPending

  const metaApiStatus = useMemo(
    () =>
      getMetaInformeApiStatus({
        informe: {
          isLoading: informeQuery.isLoading,
          isFetching: informeQuery.isFetching,
          isError: informeQuery.isError || syncMutation.isError,
          isSuccess: informeQuery.isSuccess && !syncMutation.isError,
          error:
            (informeQuery.error as Error | null) ??
            (syncMutation.error as Error | null),
        },
        isSyncing: syncMutation.isPending,
        hourlyError,
      }),
    [
      informeQuery.isLoading,
      informeQuery.isFetching,
      informeQuery.isError,
      informeQuery.isSuccess,
      informeQuery.error,
      syncMutation.isError,
      syncMutation.isPending,
      syncMutation.error,
      hourlyError,
    ]
  )

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Informe IA · Meta
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Cron cada hora a Telegram (GitHub Actions).{" "}
            <strong className="text-foreground font-medium">Vista previa</strong>{" "}
            muestra el mensaje aquí abajo (no envía).{" "}
            <strong className="text-foreground font-medium">Enviar a Telegram</strong>{" "}
            usa el mismo informe y lo manda al bot.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetaApiStatusIndicator status={metaApiStatus} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={pending}
          >
            <RiRefreshLine
              className={cn("size-4", syncMutation.isPending && "animate-spin")}
            />
            Sincronizar Meta
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => previewMutation.mutate()}
            disabled={hourlyPending || informeQuery.isLoading}
          >
            <RiBrainLine
              className={cn("size-4", previewMutation.isPending && "animate-pulse")}
            />
            Vista previa
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => sendMutation.mutate()}
            disabled={hourlyPending || informeQuery.isLoading}
          >
            <RiBrainLine
              className={cn("size-4", sendMutation.isPending && "animate-pulse")}
            />
            Enviar a Telegram
          </Button>
        </div>
      </div>

      {hourlyLoadingLabel ? (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm dark:border-blue-500/30 dark:bg-blue-500/10">
          <RiRefreshLine className="size-4 shrink-0 animate-spin text-blue-600" />
          <p className="text-blue-800 dark:text-blue-300">
            {hourlyLoadingLabel} Puede tardar hasta 1 minuto.
          </p>
        </div>
      ) : null}

      {hourlyError ? (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm dark:border-red-500/30 dark:bg-red-500/10">
          <RiAlertLine className="mt-0.5 size-4 shrink-0 text-red-600" />
          <p className="text-red-800 dark:text-red-300">{hourlyError}</p>
        </div>
      ) : null}

      {telegramSent !== null ? (
        <p className="text-muted-foreground text-xs">
          {telegramSent > 0
            ? `Informe enviado a ${telegramSent} chat(s) de Telegram.`
            : "No se envió a Telegram (revisa TELEGRAM_BOT_TOKEN y TELEGRAM_ALLOWED_USER_IDS en Vercel)."}
        </p>
      ) : null}

      {aiText ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            Vista previa del mensaje de Telegram
          </p>
          {aiText}
        </div>
      ) : null}

      {data && data.sinVentasAlerts.length > 0 ? (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm dark:border-red-500/30 dark:bg-red-500/10">
          <RiAlertLine className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-300">
              {data.sinVentasAlerts.length} con gasto alto sin ventas (−1)
            </p>
          </div>
        </div>
      ) : null}

      {data && data.cpaAltoAlerts.length > 0 ? (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm dark:border-red-500/30 dark:bg-red-500/10">
          <RiAlertLine className="mt-0.5 size-4 shrink-0 text-red-600" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-300">
              {data.cpaAltoAlerts.length} con CPA &gt; 15k (−1)
            </p>
          </div>
        </div>
      ) : null}

      {data ? (
        <PauseAlertsBanner
          variant="amber"
          title={`${data.adsetsToPause.length} conjunto${data.adsetsToPause.length === 1 ? "" : "s"} ≥10k COP hoy sin ventas — considera apagar`}
          items={data.adsetsToPause}
        />
      ) : null}

      {data ? (
        <PauseAlertsBanner
          variant="red"
          title={`${data.campaignsToPause.length} campaña${data.campaignsToPause.length === 1 ? "" : "s"} ≥30k COP hoy sin ventas — considera apagar`}
          items={data.campaignsToPause}
        />
      ) : null}

      {informeQuery.isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : informeQuery.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">
            {informeQuery.error && isMetaConfigError(informeQuery.error)
              ? "Meta no está configurado en este entorno."
              : "No se pudo cargar el informe."}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {informeQuery.error?.message ||
              "Revisa Meta, la base de datos y las variables en Vercel."}
          </p>
          {informeQuery.error && isMetaConfigError(informeQuery.error) ? (
            <MetaConfigErrorHint />
          ) : null}
        </div>
      ) : data && data.groups.length === 0 ? (
        <>
          <InformeAccountSummary
            totals={data.totals}
            yesterday={data.yesterday}
            today={data.date}
            informeStartDate={data.informeStartDate}
            dateRange={data.dateRange}
          />
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            Ninguna campaña con gasto hoy en Meta (o aún no sincronizó). Cuando
            una campaña o conjunto gaste, aparecerá aquí con puntos y estado.
          </p>
        </>
      ) : data ? (
        <>
          <InformeAccountSummary
            totals={data.totals}
            yesterday={data.yesterday}
            today={data.date}
            informeStartDate={data.informeStartDate}
            dateRange={data.dateRange}
          />
          <div className="min-w-0 overflow-x-auto rounded-lg border">
            <InformeTable
              groups={data.groups}
              yesterday={data.yesterday}
              today={data.date}
              totals={data.totals}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
