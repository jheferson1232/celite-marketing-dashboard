"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiBrainLine,
  RiRefreshLine,
  RiStackLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatCurrency, META_DASHBOARD_CURRENCY } from "@/lib/format"
import { runServerAction } from "@/lib/server-action"
import {
  formatNumber,
  getCostPerResultCellClassName,
} from "@/app/(app)/dashboard/_components/campaigns/utils"
import type { InformeCampaignGroup, InformeEntityRow } from "@/lib/services/meta/meta-operative-service"
import {
  getMetaInformeAction,
  getMetaInformeAiReminderAction,
  setMetaIntentActiveAction,
  syncMetaInformeAction,
} from "../_actions/meta-informe"

function formatDayLabel(date: string): string {
  const [, m, d] = date.split("-")
  return `${d}/${m}`
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
      title={`${cell.date}: ${cell.purchases} compras, ${formatCurrency(cell.spend, META_DASHBOARD_CURRENCY)}`}
    >
      <div className="font-medium">{formatDayLabel(cell.date)}</div>
      <div>{cell.purchases > 0 ? `${cell.purchases}v` : "—"}</div>
    </div>
  )
}

function MetricsCells({ row }: { row: InformeEntityRow }) {
  const cpaHighlight = getCostPerResultCellClassName(
    row.cpaToday,
    META_DASHBOARD_CURRENCY
  )

  return (
    <>
      <TableCell className="text-right tabular-nums">
        {formatCurrency(row.spendToday, META_DASHBOARD_CURRENCY)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.purchasesToday > 0 ? formatNumber(row.purchasesToday) : "—"}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", cpaHighlight)}>
        {row.cpaToday > 0
          ? formatCurrency(row.cpaToday, META_DASHBOARD_CURRENCY)
          : "—"}
      </TableCell>
    </>
  )
}

function StatusCells({
  row,
  onToggleIntent,
  pending,
}: {
  row: InformeEntityRow
  onToggleIntent: (entityId: string, value: boolean) => void
  pending: boolean
}) {
  return (
    <>
      <TableCell className="w-[88px] text-center">
        <Checkbox
          checked={row.intentActive}
          disabled={pending}
          onCheckedChange={(checked) =>
            onToggleIntent(row.entityId, checked === true)
          }
          aria-label={`Activé ${row.name}`}
        />
      </TableCell>
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
      <TableCell className="w-[88px] text-center">
        {row.forgotActivation ? (
          <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
            ⚠ Olvido
          </span>
        ) : row.intentActive ? (
          <span className="text-xs text-green-600 dark:text-green-400">OK</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
    </>
  )
}

function EntityRow({
  row,
  indent,
  onToggleIntent,
  pending,
  leadingCell,
}: {
  row: InformeEntityRow
  indent?: boolean
  onToggleIntent: (entityId: string, value: boolean) => void
  pending: boolean
  leadingCell?: React.ReactNode
}) {
  return (
    <TableRow
      className={cn(
        row.forgotActivation && "bg-orange-50/80 dark:bg-orange-500/10",
        indent && "bg-muted/20"
      )}
    >
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
      <StatusCells
        row={row}
        onToggleIntent={onToggleIntent}
        pending={pending}
      />
      <MetricsCells row={row} />
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
  dayHeaders,
  onToggleIntent,
  pending,
}: {
  group: InformeCampaignGroup
  isExpanded: boolean
  onToggleExpand: () => void
  dayHeaders: string[]
  onToggleIntent: (entityId: string, value: boolean) => void
  pending: boolean
}) {
  const adsetCount = group.adsets.length

  return (
    <>
      <EntityRow
        row={group.campaign}
        onToggleIntent={onToggleIntent}
        pending={pending}
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
            {adsetCount > 0 ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {adsetCount}
              </span>
            ) : null}
          </div>
        }
      />
      {isExpanded
        ? group.adsets.map((adset) => (
            <EntityRow
              key={adset.entityId}
              row={adset}
              indent
              onToggleIntent={onToggleIntent}
              pending={pending}
            />
          ))
        : null}
    </>
  )
}

function InformeTable({
  groups,
  dayHeaders,
  onToggleIntent,
  pending,
}: {
  groups: InformeCampaignGroup[]
  dayHeaders: string[]
  onToggleIntent: (entityId: string, value: boolean) => void
  pending: boolean
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
          <TableHead className="text-center">Activé</TableHead>
          <TableHead className="text-center">Meta</TableHead>
          <TableHead className="text-center">Estado</TableHead>
          <TableHead className="text-right">Gasto</TableHead>
          <TableHead className="text-right">Compras</TableHead>
          <TableHead className="text-right">CPA</TableHead>
          {dayHeaders.map((date) => (
            <TableHead key={date} className="p-1 text-center text-xs">
              {formatDayLabel(date)}
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
            dayHeaders={dayHeaders}
            onToggleIntent={onToggleIntent}
            pending={pending}
          />
        ))}
      </TableBody>
    </Table>
  )
}

export function InformeIaContent() {
  const queryClient = useQueryClient()
  const [aiText, setAiText] = useState<string | null>(null)

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

  const intentMutation = useMutation({
    mutationFn: ({
      entityId,
      intentActive,
    }: {
      entityId: string
      intentActive: boolean
    }) =>
      runServerAction(setMetaIntentActiveAction({ entityId, intentActive })),
    onSuccess: (data) => {
      queryClient.setQueryData(["meta-informe-ia"], data)
    },
  })

  const aiMutation = useMutation({
    mutationFn: () => runServerAction(getMetaInformeAiReminderAction()),
    onSuccess: (result) => {
      if (result) setAiText(result.text)
    },
  })

  const data = informeQuery.data
  const dayHeaders = data?.groups[0]?.campaign.dayCells.map((d) => d.date) ?? []
  const pending = syncMutation.isPending || intentMutation.isPending

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
            Solo Facebook/Meta. Campañas con gasto hoy; expande para ver
            conjuntos. Marca lo que activaste; el cron te avisa si olvidaste
            encenderlos. Verde = vendió; rojo = gastó sin ventas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            variant="secondary"
            size="sm"
            onClick={() => aiMutation.mutate()}
            disabled={aiMutation.isPending}
          >
            <RiBrainLine className="size-4" />
            Recordatorio IA
          </Button>
        </div>
      </div>

      {data && data.forgotten.length > 0 ? (
        <div className="flex gap-2 rounded-lg border border-orange-200 bg-orange-50/80 px-4 py-3 text-sm dark:border-orange-500/30 dark:bg-orange-500/10">
          <RiAlertLine className="mt-0.5 size-4 shrink-0 text-orange-600" />
          <div>
            <p className="font-medium text-orange-800 dark:text-orange-300">
              {data.forgotten.length} pendiente
              {data.forgotten.length === 1 ? "" : "s"} de activar en Meta
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Marcaste el check «Activé» pero Meta muestra OFF. Enciéndelos en
              Ads Manager.
            </p>
          </div>
        </div>
      ) : null}

      {aiText ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
          {aiText}
        </div>
      ) : null}

      {informeQuery.isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : informeQuery.isError ? (
        <p className="text-destructive text-sm">
          {informeQuery.error?.message ||
            "No se pudo cargar el informe. Revisa Meta y la base de datos."}
        </p>
      ) : data && data.groups.length === 0 ? (
        <>
          <p className="text-muted-foreground text-sm">
            Hoy: gasto{" "}
            {formatCurrency(data.accountSpendToday, META_DASHBOARD_CURRENCY)} ·{" "}
            {data.accountPurchasesToday} compras. Ninguna campaña con gasto hoy
            en Meta (o aún no sincronizó).
          </p>
          <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            Cuando una campaña o conjunto gaste hoy, aparecerá aquí para marcar
            si la activaste.
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
              onToggleIntent={(entityId, intentActive) =>
                intentMutation.mutate({ entityId, intentActive })
              }
              pending={pending}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
