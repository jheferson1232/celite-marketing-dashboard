"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAlertLine,
  RiBrainLine,
  RiEyeLine,
  RiEyeOffLine,
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
import {
  formatDashboardDayLabel,
  formatDashboardDayLong,
  formatDashboardDayNumeric,
  formatDashboardDayShort,
  formatDashboardDayWithWeekday,
} from "@/lib/date"
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
  countInformeActivateAdsets,
  countInformePeriodFilters,
  getInformeEntityEstadoDisplay,
  informeEstadoFilterForEntity,
  informePeriodFilterForEntity,
  shouldInformeActivateAdset,
  type InformeEstadoFilter,
  type InformeEstadoFilterKey,
} from "@/lib/services/meta/meta-informe-scoring"
import { InformeFilterBars } from "./informe-estado-filters"
import { InformeVoicePanel } from "./informe-voice-panel"
import {
  getMetaInformeAction,
  previewMetaInformeHourlyAction,
  sendMetaInformeHourlyToTelegramAction,
  syncMetaInformeAction,
} from "../_actions/meta-informe"

function formatDayLabel(date: string): string {
  return formatDashboardDayShort(date)
}

function formatInformeDate(date: string): string {
  return formatDashboardDayNumeric(date)
}

const INFORME_HIDDEN_DAY_KEYS_STORAGE = "informe-ia-hidden-day-keys"

function defaultHiddenDayKeys(
  dateKeys: string[],
  today: string,
  yesterday: string
): Set<string> {
  const hidden = new Set<string>()
  for (const date of dateKeys) {
    if (date !== today && date !== yesterday) hidden.add(date)
  }
  return hidden
}

function readStoredHiddenDayKeys(dateKeys: string[]): Set<string> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(INFORME_HIDDEN_DAY_KEYS_STORAGE)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const valid = parsed.filter(
      (d): d is string => typeof d === "string" && dateKeys.includes(d)
    )
    return new Set(valid)
  } catch {
    return null
  }
}

function writeStoredHiddenDayKeys(hidden: Set<string>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      INFORME_HIDDEN_DAY_KEYS_STORAGE,
      JSON.stringify([...hidden])
    )
  } catch {
    // ignore quota / private mode
  }
}

function InformeDayVisibilityControls({
  dateKeys,
  today,
  yesterday,
  hiddenDayKeys,
  onHiddenDayKeysChange,
}: {
  dateKeys: string[]
  today: string
  yesterday: string
  hiddenDayKeys: Set<string>
  onHiddenDayKeysChange: (next: Set<string>) => void
}) {
  const visibleCount = dateKeys.length - hiddenDayKeys.size

  const toggleDay = (date: string) => {
    const next = new Set(hiddenDayKeys)
    if (next.has(date)) next.delete(date)
    else next.add(date)
    onHiddenDayKeysChange(next)
  }

  const showOnlyRecent = () => {
    onHiddenDayKeysChange(defaultHiddenDayKeys(dateKeys, today, yesterday))
  }

  const showAll = () => {
    onHiddenDayKeysChange(new Set())
  }

  const showOnlyToday = () => {
    const next = new Set<string>()
    for (const date of dateKeys) {
      if (date !== today) next.add(date)
    }
    onHiddenDayKeysChange(next)
  }

  if (dateKeys.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-muted/20 px-2.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-xs font-medium">
          Días{" "}
          <span className="text-muted-foreground font-normal">
            ({visibleCount}/{dateKeys.length})
          </span>
        </p>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={showAll}
          >
            Todos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={showOnlyRecent}
          >
            Hoy + ayer
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={showOnlyToday}
          >
            Solo hoy
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {dateKeys.map((date) => {
          const hidden = hiddenDayKeys.has(date)
          const isToday = date === today
          const isYesterday = date === yesterday
          const relative = isToday || isYesterday
          return (
            <Button
              key={date}
              type="button"
              size="sm"
              variant={hidden ? "outline" : "secondary"}
              title={formatDashboardDayLong(date)}
              aria-label={`${hidden ? "Mostrar" : "Ocultar"} columna del ${formatDashboardDayLong(date)}`}
              className={cn(
                "h-7 gap-1 px-2 text-xs capitalize",
                isToday && !hidden && "ring-1 ring-primary/40"
              )}
              onClick={() => toggleDay(date)}
            >
              {hidden ? (
                <RiEyeOffLine className="size-3 opacity-60" />
              ) : (
                <RiEyeLine className="size-3" />
              )}
              {relative ? (
                <>
                  <span className="font-medium">
                    {formatDashboardDayLabel(date, today, yesterday)}
                  </span>
                  <span className="text-muted-foreground text-[10px] font-normal normal-case">
                    {formatDashboardDayShort(date)}
                  </span>
                </>
              ) : (
                <span>{formatDashboardDayWithWeekday(date)}</span>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
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

function filterInformeGroupsByKey(
  groups: InformeCampaignGroup[],
  filter: InformeEstadoFilter,
  match: (row: InformeEntityRow) => InformeEstadoFilterKey | null
): InformeCampaignGroup[] {
  if (filter === "ALL") return groups

  return groups
    .map((group) => {
      const campaignMatches = match(group.campaign) === filter
      const matchingAdsets = group.adsets.filter(
        (adset) => match(adset) === filter
      )
      if (!campaignMatches && matchingAdsets.length === 0) return null
      // Si la campaña coincide (ej. Crítico hoy) pero el conjunto no (ej. Excelente),
      // seguir mostrando todos los conjuntos al expandir.
      const adsets =
        matchingAdsets.length > 0
          ? matchingAdsets
          : campaignMatches
            ? group.adsets
            : []
      return { ...group, adsets }
    })
    .filter((group): group is InformeCampaignGroup => group !== null)
}

function filterInformeGroups(
  groups: InformeCampaignGroup[],
  filter: InformeEstadoFilter
): InformeCampaignGroup[] {
  return filterInformeGroupsByKey(groups, filter, informeEstadoFilterForEntity)
}

/** t/: solo conjuntos que califican; la campaña aparece si tiene al menos uno. */
function filterInformeGroupsByPeriod(
  groups: InformeCampaignGroup[],
  filter: InformeEstadoFilter
): InformeCampaignGroup[] {
  if (filter === "ALL") return groups

  return groups
    .map((group) => {
      const matchingAdsets = group.adsets.filter((adset) => {
        if (adset.spendInformeTotal <= 0) return false
        return informePeriodFilterForEntity(adset) === filter
      })
      if (matchingAdsets.length === 0) return null
      return { ...group, adsets: matchingAdsets }
    })
    .filter((group): group is InformeCampaignGroup => group !== null)
}

function filterInformeGroupsByActivar(
  groups: InformeCampaignGroup[]
): InformeCampaignGroup[] {
  return groups
    .map((group) => {
      const matchingAdsets = group.adsets.filter((adset) =>
        shouldInformeActivateAdset(adset)
      )
      if (matchingAdsets.length === 0) return null
      return { ...group, adsets: matchingAdsets }
    })
    .filter((group): group is InformeCampaignGroup => group !== null)
}

function filterInformeGroupsCombined(
  groups: InformeCampaignGroup[],
  estadoFilter: InformeEstadoFilter,
  periodFilter: InformeEstadoFilter,
  activarFilter: boolean
): InformeCampaignGroup[] {
  let result = filterInformeGroups(groups, estadoFilter)
  if (periodFilter !== "ALL") {
    result = filterInformeGroupsByPeriod(result, periodFilter)
  }
  if (activarFilter) {
    result = filterInformeGroupsByActivar(result)
  }
  return result
}

type PeriodMetrics = {
  spend: number
  purchases: number
  cpa: number
}

const METRIC_CELL =
  "px-1.5 py-1 text-right text-xs tabular-nums whitespace-nowrap"

function getMetricsForDate(
  row: InformeEntityRow,
  date: string
): PeriodMetrics {
  const cell = row.dayCells.find((d) => d.date === date)
  const spend = cell?.spend ?? 0
  const purchases = cell?.purchases ?? 0
  return {
    spend,
    purchases,
    cpa: purchases > 0 ? spend / purchases : 0,
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
        className={METRIC_CELL}
        title={`Gasto ${periodLabel}`}
      >
        {metrics.spend > 0
          ? formatCurrency(metrics.spend, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
      <TableCell
        className={METRIC_CELL}
        title={`Compras ${periodLabel}`}
      >
        {metrics.purchases > 0 ? formatNumber(metrics.purchases) : "—"}
      </TableCell>
      <TableCell
        className={cn(METRIC_CELL, cpaHighlight)}
        title={`CPA ${periodLabel}`}
      >
        {metrics.cpa > 0
          ? formatCurrency(metrics.cpa, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
    </>
  )
}

/** Gasto, compras y CPA total acumulados desde informeStartDate. */
function InformeTotalCells({
  row,
  informeStartDate,
}: {
  row: InformeEntityRow
  informeStartDate: string
}) {
  const cpaClass = getCostPerResultCellClassName(
    row.cpaInformeTotal,
    META_DASHBOARD_CURRENCY
  )
  const periodTitle = `Periodo desde ${formatInformeDate(informeStartDate)}`

  return (
    <>
      <TableCell
        className={cn(METRIC_CELL, "font-medium")}
        title={`${periodTitle} · gasto`}
      >
        {row.spendInformeTotal > 0
          ? formatCurrency(row.spendInformeTotal, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
      <TableCell
        className={cn(METRIC_CELL, "font-medium")}
        title={`${periodTitle} · compras`}
      >
        {row.purchasesInformeTotal > 0
          ? formatNumber(row.purchasesInformeTotal)
          : "—"}
      </TableCell>
      <TableCell
        className={cn(METRIC_CELL, "font-medium", cpaClass)}
        title={`${periodTitle} · CPA`}
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
  visibleDayKeys,
}: {
  row: InformeEntityRow
  visibleDayKeys: string[]
}) {
  return (
    <>
      {visibleDayKeys.map((date) => (
        <PeriodMetricsCells
          key={date}
          metrics={getMetricsForDate(row, date)}
          periodLabel={formatInformeDate(date)}
        />
      ))}
    </>
  )
}

function dayColumnHeaderClass(date: string, today: string): string {
  return cn(
    "border-border px-1 py-1 text-center text-[11px] font-semibold capitalize",
    date === today ? "bg-muted/20" : "bg-muted/40"
  )
}

function dayColumnSubHeaderClass(date: string, today: string): string {
  return cn(
    "px-1 py-0.5 text-right text-[10px] font-medium text-muted-foreground",
    date === today ? "bg-muted/20" : "bg-muted/40"
  )
}

function InformeAccountSummary({
  totals,
  visibleDayKeys,
  today,
  yesterday,
  informeStartDate,
  dateRange,
}: {
  totals: InformeTableTotals
  visibleDayKeys: string[]
  today: string
  yesterday: string
  informeStartDate: string
  dateRange: { from: string; to: string }
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {visibleDayKeys.map((date) => {
          const day = getDayTotalsMetrics(totals, date)
          return (
            <div
              key={date}
              className="rounded-md border bg-muted/15 px-2 py-1.5"
              title={formatDashboardDayLong(date)}
            >
              <p className="text-foreground text-[11px] font-medium capitalize leading-none">
                {formatDashboardDayLabel(date, today, yesterday)}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px] tabular-nums leading-snug">
                {formatCurrency(day.spend, META_DASHBOARD_CURRENCY)}
                <span className="mx-1 opacity-40">·</span>
                {formatNumber(day.purchases)}
                {day.cpa > 0 ? (
                  <>
                    <span className="mx-1 opacity-40">·</span>
                    {formatCurrency(day.cpa, META_DASHBOARD_CURRENCY)}
                  </>
                ) : null}
              </p>
            </div>
          )
        })}
      </div>
      <p className="text-muted-foreground text-[11px]">
        Desde {formatDayLabel(informeStartDate)}
        {dateRange.from !== dateRange.to
          ? ` · ${formatDayLabel(dateRange.from)} → ${formatDayLabel(dateRange.to)}`
          : ""}
      </p>
    </div>
  )
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
        <TableCell className="px-1.5 py-1 text-center text-xs text-muted-foreground">
          —
        </TableCell>
        <TableCell className="px-1.5 py-1 text-center text-xs text-muted-foreground">
          —
        </TableCell>
      </>
    )
  }

  return (
    <>
      <TableCell className="px-1.5 py-1 text-center text-xs tabular-nums">
        {adSetsCount}
      </TableCell>
      <TableCell className="px-1.5 py-1 text-center text-xs tabular-nums">
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
      <TableCell className="w-12 px-1 py-1 text-center">
        <span
          className={cn(
            "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium",
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
          "min-w-[88px] max-w-[110px] px-1 py-1 text-center text-[11px]",
          INFORME_ESTADO_TONE_CLASS[estadoDisplay.tone]
        )}
        title={estadoDisplay.title}
      >
        <span className="flex flex-col items-center gap-0.5 leading-tight">
          <span>{estadoDisplay.label}</span>
          {estadoDisplay.hint ? (
            <span className="text-[9px] font-normal opacity-90">
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
  visibleDayKeys,
  informeStartDate,
  indent,
  campaignActions,
  adSetsCount,
  activeAdSetsCount,
}: {
  row: InformeEntityRow
  visibleDayKeys: string[]
  informeStartDate: string
  indent?: boolean
  /** Solo filas de campaña: conjuntos + links (como dashboard Meta). */
  campaignActions?: React.ReactNode
  adSetsCount?: number
  activeAdSetsCount?: number
}) {
  return (
    <TableRow className={cn("group", indent && "bg-muted/20")}>
      <TableCell
        className={cn(
          "sticky left-0 z-[1] max-w-[168px] bg-background px-2 py-1 group-hover:bg-muted/50",
          indent && "bg-muted/20 pl-8 group-hover:bg-muted/50"
        )}
      >
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0">
            <span className="truncate text-xs font-medium leading-tight">
              {row.name}
            </span>
            <span className="text-muted-foreground text-[10px]">
              {row.type === "campaign" ? "Campaña" : "Conjunto"}
            </span>
          </div>
          {campaignActions ? (
            <div className="flex shrink-0 items-center gap-0.5">
              {campaignActions}
            </div>
          ) : null}
        </div>
      </TableCell>
      <StatusCells row={row} />
      <AdsetCountCells
        adSetsCount={adSetsCount}
        activeAdSetsCount={activeAdSetsCount}
      />
      <InformeTotalCells row={row} informeStartDate={informeStartDate} />
      <MetricsCells row={row} visibleDayKeys={visibleDayKeys} />
    </TableRow>
  )
}

function CampaignGroupRows({
  group,
  isExpanded,
  onToggleExpand,
  visibleDayKeys,
  informeStartDate,
}: {
  group: InformeCampaignGroup
  isExpanded: boolean
  onToggleExpand: () => void
  visibleDayKeys: string[]
  informeStartDate: string
}) {
  const adsetCount = group.adsets.length
  const catalogAdsetCount = group.adSetsCount ?? 0

  return (
    <>
      <EntityRow
        row={group.campaign}
        visibleDayKeys={visibleDayKeys}
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
                  ? catalogAdsetCount > 0
                    ? `${catalogAdsetCount} conjuntos en Meta; ninguno con gasto en el periodo del informe. Quita filtros o sincroniza.`
                    : "Sin conjuntos con gasto en el informe"
                  : isExpanded
                    ? "Ocultar conjuntos"
                    : `Ver ${adsetCount} conjunto${adsetCount === 1 ? "" : "s"} con gasto en el informe`
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
              visibleDayKeys={visibleDayKeys}
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
  visibleDayKeys,
}: {
  groups: InformeCampaignGroup[]
  totals: InformeTableTotals
  visibleDayKeys: string[]
}) {
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
      <TableCell
        colSpan={5}
        className="sticky left-0 z-[1] bg-muted/60 px-2 py-1 text-left text-xs"
      >
        Total (conjuntos)
      </TableCell>
      <TableCell
        className={METRIC_CELL}
        title="Suma gasto conjuntos (periodo del informe)"
      >
        {adsetSpendTotal > 0
          ? formatCurrency(adsetSpendTotal, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
      <TableCell
        className={METRIC_CELL}
        title="Suma compras conjuntos (periodo del informe)"
      >
        {adsetPurchasesTotal > 0 ? formatNumber(adsetPurchasesTotal) : "—"}
      </TableCell>
      <TableCell
        className={METRIC_CELL}
        title="CPA total conjuntos (periodo del informe)"
      >
        {adsetCpaTotal > 0
          ? formatCurrency(adsetCpaTotal, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
      {visibleDayKeys.map((date) => (
        <PeriodMetricsCells
          key={date}
          metrics={getDayTotalsMetrics(totals, date)}
          periodLabel={formatInformeDate(date)}
          highlightCpa={false}
        />
      ))}
    </TableRow>
  )
}

function InformeTable({
  groups,
  visibleDayKeys,
  today,
  yesterday,
  totals,
  informeStartDate,
}: {
  groups: InformeCampaignGroup[]
  visibleDayKeys: string[]
  today: string
  yesterday: string
  totals: InformeTableTotals
  informeStartDate: string
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
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 z-[2] min-w-[148px] bg-background px-2 py-1 text-xs" rowSpan={2}>
            Nombre
          </TableHead>
          <TableHead className="w-12 px-1 py-1 text-center text-[11px]" rowSpan={2}>
            Meta
          </TableHead>
          <TableHead className="min-w-[88px] px-1 py-1 text-center text-[11px]" rowSpan={2}>
            Estado
          </TableHead>
          <TableHead
            className="px-1 py-1 text-center text-[11px]"
            rowSpan={2}
            title="Conjuntos"
          >
            Conj.
          </TableHead>
          <TableHead
            className="px-1 py-1 text-center text-[11px]"
            rowSpan={2}
            title="Conjuntos activos"
          >
            Act.
          </TableHead>
          <TableHead
            className="border-border bg-muted/30 px-1 py-1 text-center text-[11px] font-semibold"
            rowSpan={2}
            title="Gasto total del periodo"
          >
            $ tot
          </TableHead>
          <TableHead
            className="border-border bg-muted/30 px-1 py-1 text-center text-[11px] font-semibold"
            rowSpan={2}
            title="Compras total del periodo"
          >
            Comp
          </TableHead>
          <TableHead
            className="border-border bg-muted/30 px-1 py-1 text-center text-[11px] font-semibold"
            rowSpan={2}
            title="CPA total del periodo"
          >
            CPA
          </TableHead>
          {visibleDayKeys.map((date) => (
            <TableHead
              key={date}
              colSpan={3}
              title={formatDashboardDayLong(date)}
              className={dayColumnHeaderClass(date, today)}
            >
              {formatDashboardDayLabel(date, today, yesterday)}
            </TableHead>
          ))}
        </TableRow>
        <TableRow>
          {visibleDayKeys.map((date) => (
            <Fragment key={date}>
              <TableHead
                className={dayColumnSubHeaderClass(date, today)}
                title="Gasto"
              >
                $
              </TableHead>
              <TableHead
                className={dayColumnSubHeaderClass(date, today)}
                title="Compras"
              >
                n
              </TableHead>
              <TableHead
                className={dayColumnSubHeaderClass(date, today)}
                title="CPA"
              >
                CPA
              </TableHead>
            </Fragment>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <CampaignGroupRows
            key={group.campaign.entityId}
            group={group}
            isExpanded={expandedCampaignIds.has(group.campaign.metaId)}
            onToggleExpand={() => handleToggleExpand(group.campaign.metaId)}
            visibleDayKeys={visibleDayKeys}
            informeStartDate={informeStartDate}
          />
        ))}
      </TableBody>
      <TableFooter>
        <InformeTotalsRow
          groups={groups}
          totals={totals}
          visibleDayKeys={visibleDayKeys}
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
  const [periodFilter, setPeriodFilter] = useState<InformeEstadoFilter>("ALL")
  const [activarFilter, setActivarFilter] = useState(false)
  const [hiddenDayKeys, setHiddenDayKeys] = useState<Set<string>>(() => new Set())
  const [hiddenDaysInitKey, setHiddenDaysInitKey] = useState<string | null>(
    null
  )

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

  useEffect(() => {
    if (!data?.dateKeys.length) return
    const initKey = `${data.date}:${data.yesterday}:${data.dateKeys.join(",")}`
    if (hiddenDaysInitKey === initKey) return

    const stored = readStoredHiddenDayKeys(data.dateKeys)
    setHiddenDayKeys(
      stored ?? defaultHiddenDayKeys(data.dateKeys, data.date, data.yesterday)
    )
    setHiddenDaysInitKey(initKey)
  }, [data, hiddenDaysInitKey])

  useEffect(() => {
    if (hiddenDaysInitKey == null) return
    writeStoredHiddenDayKeys(hiddenDayKeys)
  }, [hiddenDayKeys, hiddenDaysInitKey])

  const visibleDayKeys = useMemo(() => {
    if (!data) return []
    return data.dateKeys.filter((date) => !hiddenDayKeys.has(date))
  }, [data, hiddenDayKeys])

  const handleHiddenDayKeysChange = useCallback((next: Set<string>) => {
    setHiddenDayKeys(next)
  }, [])

  const estadoCounts = useMemo(
    () => (data ? countInformeEstadoFilters(data.groups) : null),
    [data]
  )

  const periodCounts = useMemo(
    () => (data ? countInformePeriodFilters(data.groups) : null),
    [data]
  )

  const activarCount = useMemo(
    () => (data ? countInformeActivateAdsets(data.groups) : 0),
    [data]
  )

  const filteredGroups = useMemo(
    () =>
      data
        ? filterInformeGroupsCombined(
            data.groups,
            estadoFilter,
            periodFilter,
            activarFilter
          )
        : [],
    [data, estadoFilter, periodFilter, activarFilter]
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
    <div className="flex w-full flex-col gap-3 p-4 pb-8 lg:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">
            Informe IA · Meta
          </h1>
          <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs leading-snug">
            Cron a Telegram (8:00 y 20:00 Lima, GitHub Actions): solo conjuntos{" "}
            <span className="font-medium text-green-700 dark:text-green-400">
              ON
            </span>{" "}
            en{" "}
            <span className="font-medium text-red-700 dark:text-red-400">
              Crítico
            </span>{" "}
            para revisar o desactivar. Los botones{" "}
            <span className="font-medium text-green-700 dark:text-green-400">
              t/exelente
            </span>
            ,{" "}
            <span className="font-medium text-orange-600 dark:text-orange-400">
              t/curso
            </span>{" "}
            ,{" "}
            <span className="font-medium text-red-700 dark:text-red-400">
              t/critico
            </span>{" "}
            y{" "}
            <span className="font-medium text-yellow-700 dark:text-yellow-300">
              activar
            </span>{" "}
            (conjuntos OFF con buen CPA total) filtran la misma tabla.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
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
          <InformeVoicePanel />
        </div>
      </div>

      {pending ? (
        <p className="text-muted-foreground text-xs">
          Sincronizando Meta… Suele tardar menos que antes; si ves límite de
          API, espera unos minutos.
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
            visibleDayKeys={visibleDayKeys}
            today={data.date}
            yesterday={data.yesterday}
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
            visibleDayKeys={visibleDayKeys}
            today={data.date}
            yesterday={data.yesterday}
            informeStartDate={data.informeStartDate}
            dateRange={data.dateRange}
          />
          <InformeDayVisibilityControls
            dateKeys={data.dateKeys}
            today={data.date}
            yesterday={data.yesterday}
            hiddenDayKeys={hiddenDayKeys}
            onHiddenDayKeysChange={handleHiddenDayKeysChange}
          />
          {estadoCounts && periodCounts ? (
            <InformeFilterBars
              estadoCounts={estadoCounts}
              periodCounts={periodCounts}
              activarCount={activarCount}
              estadoFilter={estadoFilter}
              periodFilter={periodFilter}
              activarFilter={activarFilter}
              onEstadoFilterChange={setEstadoFilter}
              onPeriodFilterChange={setPeriodFilter}
              onActivarFilterChange={setActivarFilter}
            />
          ) : null}
          {filteredGroups.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
              Ningún resultado con los filtros actuales. Prueba «todas», otro
              botón t/ o desactiva «activar».
            </p>
          ) : visibleDayKeys.length === 0 ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
              No hay días visibles en la tabla. Pulsa{" "}
              <strong className="text-foreground">Todos</strong> o{" "}
              <strong className="text-foreground">Hoy + ayer</strong>.
            </p>
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-md border">
              <InformeTable
                groups={filteredGroups}
                visibleDayKeys={visibleDayKeys}
                today={data.date}
                yesterday={data.yesterday}
                totals={data.totals}
                informeStartDate={data.informeStartDate}
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
