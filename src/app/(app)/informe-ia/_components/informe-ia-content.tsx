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
import { formatInformePoints } from "@/lib/services/meta/meta-informe-scoring"
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

function formatDayHeader(date: string, yesterday: string): string {
  if (date === yesterday) return "Ayer"
  return formatDayLabel(date)
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

function rowHighlightClass(highlight: InformeEntityRow["rowHighlight"]): string {
  if (highlight === "red") return "bg-red-50/80 dark:bg-red-500/10"
  if (highlight === "orange") return "bg-orange-50/80 dark:bg-orange-500/10"
  return ""
}

function DayCell({ cell }: { cell: InformeEntityRow["dayCells"][0] }) {
  return (
    <div
      className={cn(
        "rounded-md px-1.5 py-1 text-center text-xs",
        cell.saleStatus === "green" &&
          "bg-green-50 text-green-800 dark:bg-green-500/15 dark:text-green-400",
        cell.saleStatus === "red" &&
          "bg-red-50 text-red-800 dark:bg-red-500/15 dark:text-red-400",
        cell.saleStatus === "neutral" && "bg-muted/40 text-muted-foreground"
      )}
      title={`${cell.date}: ${formatCurrency(cell.spend, META_DASHBOARD_CURRENCY)}, ${cell.purchases} compras, pts ${formatInformePoints(cell.points)}`}
    >
      <div className="font-medium tabular-nums">
        {formatInformePoints(cell.points)}
      </div>
      <div className="text-muted-foreground">
        {cell.purchases > 0 ? `${cell.purchases}v` : "—"}
      </div>
    </div>
  )
}

function getDisplayMetrics(row: InformeEntityRow, yesterday: string) {
  const hasToday = row.spendToday > 0 || row.purchasesToday > 0
  if (hasToday) {
    return {
      spend: row.spendToday,
      purchases: row.purchasesToday,
      cpa: row.cpaToday,
      period: "hoy" as const,
    }
  }

  const yCell = row.dayCells.find((d) => d.date === yesterday)
  if (yCell && (yCell.spend > 0 || yCell.purchases > 0)) {
    return {
      spend: yCell.spend,
      purchases: yCell.purchases,
      cpa: yCell.purchases > 0 ? yCell.spend / yCell.purchases : 0,
      period: "ayer" as const,
    }
  }

  return { spend: 0, purchases: 0, cpa: 0, period: null }
}

function MetricsCells({
  row,
  yesterday,
}: {
  row: InformeEntityRow
  yesterday: string
}) {
  const m = getDisplayMetrics(row, yesterday)
  const cpaHighlight = getCostPerResultCellClassName(
    m.cpa,
    META_DASHBOARD_CURRENCY
  )
  const periodHint =
    m.period === "ayer"
      ? " (ayer)"
      : m.period === "hoy"
        ? " (hoy)"
        : ""

  return (
    <>
      <TableCell className="text-right tabular-nums" title={`Gasto${periodHint}`}>
        <div>
          {m.spend > 0
            ? formatCurrency(m.spend, META_DASHBOARD_CURRENCY)
            : "—"}
        </div>
        {m.period === "ayer" ? (
          <div className="text-muted-foreground text-[10px] font-normal">
            ayer
          </div>
        ) : null}
      </TableCell>
      <TableCell
        className="text-right tabular-nums"
        title={`Compras${periodHint}`}
      >
        {m.purchases > 0 ? formatNumber(m.purchases) : "—"}
      </TableCell>
      <TableCell
        className={cn("text-right tabular-nums", cpaHighlight)}
        title={`CPA${periodHint}`}
      >
        {m.cpa > 0 ? formatCurrency(m.cpa, META_DASHBOARD_CURRENCY) : "—"}
      </TableCell>
    </>
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
              ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
              : "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400"
          )}
        >
          {row.metaWasActive ? "ON" : "OFF"}
        </span>
      </TableCell>
      <TableCell
        className={cn(
          "min-w-[140px] text-center text-xs",
          row.rowHighlight === "red" &&
            "font-medium text-red-600 dark:text-red-400",
          row.rowHighlight === "orange" &&
            "font-medium text-orange-600 dark:text-orange-400"
        )}
      >
        {row.estadoLabel}
      </TableCell>
      <TableCell
        className={cn(
          "w-[56px] text-center tabular-nums text-sm font-medium",
          row.pointsTotal > 0 && "text-green-600 dark:text-green-400",
          row.pointsTotal < 0 && "text-red-600 dark:text-red-400"
        )}
        title="Suma del rango (máximo −1 por fila)"
      >
        {formatInformePoints(row.pointsTotal)}
      </TableCell>
    </>
  )
}

function EntityRow({
  row,
  yesterday,
  indent,
  leadingCell,
  adSetsCount,
  activeAdSetsCount,
}: {
  row: InformeEntityRow
  yesterday: string
  indent?: boolean
  leadingCell?: React.ReactNode
  adSetsCount?: number
  activeAdSetsCount?: number
}) {
  return (
    <TableRow className={cn(rowHighlightClass(row.rowHighlight), indent && "bg-muted/20")}>
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
      <MetricsCells row={row} yesterday={yesterday} />
      {row.dayCells.map((cell) => (
        <TableCell key={cell.date} className="w-[52px] p-1">
          <DayCell cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  )
}

function CampaignGroupRows({
  group,
  isExpanded,
  onToggleExpand,
  yesterday,
}: {
  group: InformeCampaignGroup
  isExpanded: boolean
  onToggleExpand: () => void
  yesterday: string
}) {
  const adsetCount = group.adsets.length

  return (
    <>
      <EntityRow
        row={group.campaign}
        yesterday={yesterday}
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
  dayHeaders,
}: {
  totals: InformeTableTotals
  yesterday: string
  dayHeaders: string[]
}) {
  const dayByDate = new Map(totals.dayTotals.map((d) => [d.date, d]))
  const yDay = dayByDate.get(yesterday)
  const hasToday =
    totals.spendToday > 0 || totals.purchasesToday > 0
  const spend = hasToday ? totals.spendToday : (yDay?.spend ?? 0)
  const purchases = hasToday
    ? totals.purchasesToday
    : (yDay?.purchases ?? 0)
  const cpa = purchases > 0 ? spend / purchases : 0
  const cpaHighlight = getCostPerResultCellClassName(
    cpa,
    META_DASHBOARD_CURRENCY
  )

  return (
    <TableRow className="bg-muted/60 border-t-2 font-semibold">
      <TableCell>Total (conjuntos)</TableCell>
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell
        className={cn(
          "text-center tabular-nums",
          totals.pointsTotal > 0 && "text-green-600 dark:text-green-400",
          totals.pointsTotal < 0 && "text-red-600 dark:text-red-400"
        )}
        title="Suma de puntos solo conjuntos"
      >
        {formatInformePoints(totals.pointsTotal)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {spend > 0 ? formatCurrency(spend, META_DASHBOARD_CURRENCY) : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {purchases > 0 ? formatNumber(purchases) : "—"}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", cpaHighlight)}>
        {cpa > 0 ? formatCurrency(cpa, META_DASHBOARD_CURRENCY) : "—"}
      </TableCell>
      {dayHeaders.map((date) => {
        const day = dayByDate.get(date)
        return (
          <TableCell key={date} className="p-1 text-center text-xs tabular-nums">
            <div>{formatInformePoints(day?.points ?? 0)}</div>
            <div className="text-muted-foreground font-normal">
              {formatDayHeader(date, yesterday)}
            </div>
          </TableCell>
        )
      })}
    </TableRow>
  )
}

function InformeTable({
  groups,
  dayHeaders,
  yesterday,
  totals,
}: {
  groups: InformeCampaignGroup[]
  dayHeaders: string[]
  yesterday: string
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
          <TableHead className="min-w-[220px]">Nombre</TableHead>
          <TableHead className="text-center">Meta</TableHead>
          <TableHead className="text-center">Estado</TableHead>
          <TableHead className="text-center">Puntos</TableHead>
          <TableHead className="text-center">Conjuntos</TableHead>
          <TableHead className="text-center">Conj. activos</TableHead>
          <TableHead className="text-right" title="Hoy; si no hay gasto, muestra ayer">
            Gasto
          </TableHead>
          <TableHead className="text-right" title="Hoy; si no hay ventas, muestra ayer">
            Compras
          </TableHead>
          <TableHead className="text-right" title="Hoy; si no hay ventas, muestra ayer">
            CPA
          </TableHead>
          {dayHeaders.map((date) => (
            <TableHead key={date} className="p-1 text-center text-xs">
              {formatDayHeader(date, yesterday)}
            </TableHead>
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
            yesterday={yesterday}
          />
        ))}
      </TableBody>
      <TableFooter>
        <InformeTotalsRow
          totals={totals}
          yesterday={yesterday}
          dayHeaders={dayHeaders}
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
  const dayHeaders = data?.groups[0]?.campaign.dayCells.map((d) => d.date) ?? []
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

  const accountCpa =
    data && data.accountPurchasesToday > 0
      ? data.accountSpendToday / data.accountPurchasesToday
      : 0

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

      {data && data.olvidoAlerts.length > 0 ? (
        <div className="flex gap-2 rounded-lg border border-orange-200 bg-orange-50/80 px-4 py-3 text-sm dark:border-orange-500/30 dark:bg-orange-500/10">
          <RiAlertLine className="mt-0.5 size-4 shrink-0 text-orange-600" />
          <div>
            <p className="font-medium text-orange-800 dark:text-orange-300">
              {data.olvidoAlerts.length} olvido
              {data.olvidoAlerts.length === 1 ? "" : "s"} — no activaste ayer
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Ayer hubo gasto pero Meta estaba apagado. Enciéndelos en Ads
              Manager. Con ≤ −3 puntos acumulados no se envían avisos.
            </p>
          </div>
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
          <p className="text-muted-foreground text-sm">
            Hoy: gasto{" "}
            {formatCurrency(data.accountSpendToday, META_DASHBOARD_CURRENCY)} ·{" "}
            {data.accountPurchasesToday} compras. Ninguna campaña con gasto hoy
            en Meta (o aún no sincronizó).
          </p>
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            Cuando una campaña o conjunto gaste hoy, aparecerá aquí con puntos
            y estado automático.
          </p>
        </>
      ) : data ? (
        <>
          <p className="text-muted-foreground text-sm">
            Hoy: gasto{" "}
            {formatCurrency(data.accountSpendToday, META_DASHBOARD_CURRENCY)} ·{" "}
            {formatNumber(data.accountPurchasesToday)} compras
            {accountCpa > 0
              ? ` · CPA ${formatCurrency(accountCpa, META_DASHBOARD_CURRENCY)}`
              : ""}{" "}
            · Informe desde {formatDayLabel(data.informeStartDate)}
            {data.dateRange.from !== data.dateRange.to
              ? ` (${formatDayLabel(data.dateRange.from)} → ${formatDayLabel(data.dateRange.to)})`
              : " (solo hoy)"}
          </p>
          <div className="min-w-0 overflow-x-auto rounded-lg border">
            <InformeTable
              groups={data.groups}
              dayHeaders={dayHeaders}
              yesterday={data.yesterday}
              totals={data.totals}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
