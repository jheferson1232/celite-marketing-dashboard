"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAlertLine,
  RiBrainLine,
  RiRefreshLine,
  RiStackLine,
} from "@remixicon/react"
import { MetaCampaignLandingUrlsButton } from "@/app/(app)/dashboard/_components/campaigns/meta-campaign-landing-urls-button"
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
import {
  getInformeEntityEstadoDisplay,
  informeEstadoFilterForEntity,
  type InformeEstadoFilter,
  type InformeEstadoFilterKey,
} from "@/lib/services/meta/meta-informe-scoring"
import { InformeEstadoFilters } from "./informe-estado-filters"
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

function formatInformeRowLabel(
  row: InformeEntityRow,
  groups: InformeCampaignGroup[]
): string {
  if (row.type === "campaign") return row.name
  const group = groups.find((g) =>
    g.adsets.some((a) => a.entityId === row.entityId)
  )
  return group ? `${row.name} (${group.campaign.name})` : row.name
}

function countInformeEstadoFilters(
  groups: InformeCampaignGroup[]
): Record<InformeEstadoFilterKey, number> {
  const counts: Record<InformeEstadoFilterKey, number> = {
    EXCELENTE: 0,
    EN_CURSO: 0,
    CRITICO: 0,
  }
  for (const group of groups) {
    for (const row of [group.campaign, ...group.adsets]) {
      const key = informeEstadoFilterForEntity(row)
      if (key) counts[key]++
    }
  }
  return counts
}

function filterInformeGroups(
  groups: InformeCampaignGroup[],
  filter: InformeEstadoFilter
): InformeCampaignGroup[] {
  if (filter === "ALL") return groups

  return groups
    .map((group) => {
      const campaignMatches =
        informeEstadoFilterForEntity(group.campaign) === filter
      const matchingAdsets = group.adsets.filter(
        (adset) => informeEstadoFilterForEntity(adset) === filter
      )
      if (!campaignMatches && matchingAdsets.length === 0) return null
      return { ...group, adsets: matchingAdsets }
    })
    .filter((group): group is InformeCampaignGroup => group !== null)
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

/** Gasto y CPA total: campaña (desde inicio informe) · conjunto (ayer + hoy). */
function InformeTotalCells({
  row,
  informeStartDate,
  yesterday,
  today,
}: {
  row: InformeEntityRow
  informeStartDate: string
  yesterday: string
  today: string
}) {
  const cpaClass = getCostPerResultCellClassName(
    row.cpaInformeTotal,
    META_DASHBOARD_CURRENCY
  )
  const spendTitle =
    row.type === "campaign"
      ? `Gasto desde ${formatInformeDate(informeStartDate)} (todas las fechas del informe)`
      : `Gasto ayer (${formatInformeDate(yesterday)}) + hoy (${formatInformeDate(today)})`
  const cpaTitle =
    row.type === "campaign"
      ? row.purchasesInformeTotal > 0
        ? `CPA total informe · ${formatNumber(row.purchasesInformeTotal)} compras`
        : "CPA total del informe"
      : row.purchasesInformeTotal > 0
        ? `CPA ayer+hoy · ${formatNumber(row.purchasesInformeTotal)} compras`
        : "CPA ayer+hoy (sin compras en el periodo)"

  return (
    <>
      <TableCell
        className="text-right tabular-nums font-medium"
        title={spendTitle}
      >
        {row.spendInformeTotal > 0
          ? formatCurrency(row.spendInformeTotal, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
      <TableCell
        className={cn("text-right tabular-nums font-medium", cpaClass)}
        title={cpaTitle}
      >
        {row.cpaInformeTotal > 0
          ? formatCurrency(row.cpaInformeTotal, META_DASHBOARD_CURRENCY)
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

const INFORME_ESTADO_TONE_CLASS: Record<
  ReturnType<typeof getInformeEntityEstadoDisplay>["tone"],
  string
> = {
  green: "font-medium text-green-600 dark:text-green-400",
  orange: "font-medium text-orange-600 dark:text-orange-400",
  red: "font-medium text-red-600 dark:text-red-400",
  muted: "text-muted-foreground",
}

function StatusCells({ row }: { row: InformeEntityRow }) {
  const estadoDisplay = getInformeEntityEstadoDisplay({
    type: row.type,
    spendToday: row.spendToday,
    purchasesToday: row.purchasesToday,
    cpaToday: row.cpaToday,
  })

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
          "min-w-[120px] text-center text-xs",
          INFORME_ESTADO_TONE_CLASS[estadoDisplay.tone]
        )}
        title={estadoDisplay.title}
      >
        <span className="flex flex-col items-center gap-0.5 leading-tight">
          <span>{estadoDisplay.label}</span>
          {estadoDisplay.hint ? (
            <span className="text-[10px] font-normal opacity-90">
              {estadoDisplay.hint}
            </span>
          ) : null}
        </span>
      </TableCell>
    </>
  )
}

function EntityRow({
  row,
  yesterday,
  today,
  informeStartDate,
  indent,
  campaignActions,
  adSetsCount,
  activeAdSetsCount,
}: {
  row: InformeEntityRow
  yesterday: string
  today: string
  informeStartDate: string
  indent?: boolean
  /** Solo filas de campaña: conjuntos + links (como dashboard Meta). */
  campaignActions?: React.ReactNode
  adSetsCount?: number
  activeAdSetsCount?: number
}) {
  return (
    <TableRow className={cn(indent && "bg-muted/20")}>
      <TableCell className={cn("max-w-[280px]", indent && "pl-10")}>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-medium leading-tight">{row.name}</span>
            <span className="text-muted-foreground text-xs">
              {row.type === "campaign" ? "Campaña" : "Conjunto"}
            </span>
          </div>
          {campaignActions ? (
            <div className="flex shrink-0 items-center gap-1">{campaignActions}</div>
          ) : null}
        </div>
      </TableCell>
      <StatusCells row={row} />
      <AdsetCountCells
        adSetsCount={adSetsCount}
        activeAdSetsCount={activeAdSetsCount}
      />
      <InformeTotalCells
        row={row}
        informeStartDate={informeStartDate}
        yesterday={yesterday}
        today={today}
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
  informeStartDate,
}: {
  group: InformeCampaignGroup
  isExpanded: boolean
  onToggleExpand: () => void
  yesterday: string
  today: string
  informeStartDate: string
}) {
  const adsetCount = group.adsets.length

  return (
    <>
      <EntityRow
        row={group.campaign}
        yesterday={yesterday}
        today={today}
        informeStartDate={informeStartDate}
        adSetsCount={group.adSetsCount}
        activeAdSetsCount={group.activeAdSetsCount}
        campaignActions={
          <>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
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
                  ? "Sin conjuntos con gasto en el informe"
                  : isExpanded
                    ? "Ocultar conjuntos"
                    : `Ver ${adsetCount} conjunto${adsetCount === 1 ? "" : "s"}`
              }
            >
              <RiStackLine data-icon="inline-start" />
            </Button>
            <MetaCampaignLandingUrlsButton
              campaignId={group.campaign.metaId}
              campaignName={group.campaign.name}
              urls={[]}
            />
          </>
        }
      />
      {isExpanded
        ? group.adsets.map((adset) => (
            <EntityRow
              key={adset.entityId}
              row={adset}
              yesterday={yesterday}
              today={today}
              informeStartDate={informeStartDate}
              indent
            />
          ))
        : null}
    </>
  )
}

function InformeTotalsRow({
  groups,
  totals,
  yesterday,
  today,
}: {
  groups: InformeCampaignGroup[]
  totals: InformeTableTotals
  yesterday: string
  today: string
}) {
  const ayer = getDayTotalsMetrics(totals, yesterday)
  const hoy = getTodayMetricsFromTotals(totals)

  let adsetSpendTotal = 0
  let adsetPurchasesTotal = 0
  for (const group of groups) {
    for (const adset of group.adsets) {
      adsetSpendTotal += adset.spendInformeTotal
      adsetPurchasesTotal += adset.purchasesInformeTotal
    }
  }
  const adsetCpaTotal =
    adsetPurchasesTotal > 0 ? adsetSpendTotal / adsetPurchasesTotal : 0

  return (
    <TableRow className="bg-muted/60 border-t-2 font-semibold">
      <TableCell colSpan={5} className="text-left">
        Total (conjuntos)
      </TableCell>
      <TableCell
        className="text-right tabular-nums"
        title="Suma gasto conjuntos (ayer + hoy)"
      >
        {adsetSpendTotal > 0
          ? formatCurrency(adsetSpendTotal, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
      <TableCell
        className="text-right tabular-nums"
        title="CPA total conjuntos (ayer + hoy)"
      >
        {adsetCpaTotal > 0
          ? formatCurrency(adsetCpaTotal, META_DASHBOARD_CURRENCY)
          : "—"}
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
  informeStartDate,
  estadoFilter,
}: {
  groups: InformeCampaignGroup[]
  yesterday: string
  today: string
  totals: InformeTableTotals
  informeStartDate: string
  estadoFilter: InformeEstadoFilter
}) {
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<Set<string>>(
    () => new Set()
  )

  useEffect(() => {
    if (estadoFilter === "ALL") return
    setExpandedCampaignIds((current) => {
      const next = new Set(current)
      for (const group of groups) {
        const campaignMatches =
          informeEstadoFilterForEntity(group.campaign) === estadoFilter
        if (!campaignMatches && group.adsets.length > 0) {
          next.add(group.campaign.metaId)
        }
      }
      return next
    })
  }, [estadoFilter, groups])

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
            className="border-border bg-muted/30 text-center text-xs font-semibold"
            rowSpan={2}
          >
            Gasto total
          </TableHead>
          <TableHead
            className="border-border bg-muted/30 text-center text-xs font-semibold"
            rowSpan={2}
          >
            CPA total
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
            informeStartDate={informeStartDate}
          />
        ))}
      </TableBody>
      <TableFooter>
        <InformeTotalsRow
          groups={groups}
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
  const [estadoFilter, setEstadoFilter] = useState<InformeEstadoFilter>("ALL")

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

  const estadoCounts = useMemo(
    () => (data ? countInformeEstadoFilters(data.groups) : null),
    [data]
  )

  const filteredGroups = useMemo(
    () => (data ? filterInformeGroups(data.groups, estadoFilter) : []),
    [data, estadoFilter]
  )

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
    <div className="flex w-full flex-col gap-6 p-6 pb-12 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Informe IA · Meta
          </h1>
          <p className="text-muted-foreground mt-1 max-w-xl text-sm">
            Cron cada hora a Telegram (GitHub Actions). Filtra por estado de hoy
            (CPA):{" "}
            <span className="text-green-700 dark:text-green-400">Excelente</span>,{" "}
            <span className="text-orange-700 dark:text-orange-400">En curso</span> o{" "}
            <span className="text-red-700 dark:text-red-400">Crítico</span>.
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

      {pending ? (
        <p className="text-muted-foreground text-xs">
          Sincronizando Meta y analizando campañas con IA… Puede tardar 1–2
          minutos.
        </p>
      ) : null}

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
          {estadoCounts ? (
            <InformeEstadoFilters
              counts={estadoCounts}
              selectedFilter={estadoFilter}
              onFilterChange={setEstadoFilter}
            />
          ) : null}
          {filteredGroups.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
              Ninguna campaña ni conjunto con estado{" "}
              {estadoFilter === "EXCELENTE"
                ? "Excelente"
                : estadoFilter === "EN_CURSO"
                  ? "En curso"
                  : "Crítico"}{" "}
              hoy. Prueba otro filtro o «todas».
            </p>
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-lg border">
              <InformeTable
                groups={filteredGroups}
                yesterday={data.yesterday}
                today={data.date}
                totals={data.totals}
                informeStartDate={data.informeStartDate}
                estadoFilter={estadoFilter}
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
