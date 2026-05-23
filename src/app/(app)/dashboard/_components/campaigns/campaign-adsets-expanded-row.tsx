"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { VisibilityState } from "@tanstack/react-table"
import { RiRefreshLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
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
  META_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import { runServerAction } from "@/lib/server-action"
import { isMetaRateLimitError } from "@/lib/services/meta/meta-errors"
import { cn } from "@/lib/utils"
import { useDateRange } from "../../_lib/use-date-range"
import { getCampaignAdSets } from "../../_actions/campaign-adsets"
import {
  getAdSetSubtableColumnMeta,
  getAdSetSubtableColumnsWithTikTokManage,
  getVisibleAdSetSubtableColumns,
  type AdSetSubtableColumnId,
  type TikTokAdSetManageColumnId,
} from "./ad-set-subtable-columns"
import {
  getTikTokAdSetColumnMeta,
  getTikTokAdSetDisplayColumns,
  type TikTokAdSetDisplayColumnId,
} from "@/app/(app)/tiktok/_components/tiktok-ad-set-columns"
import type { CampaignPerformanceFilter } from "./types"
import {
  getTikTokAdSetPerformanceStatus,
  hasTikTokAdSetActivityInPeriod,
} from "./utils"
import { MetaAdSetsSubtable } from "./meta-ad-sets-subtable"
import { TikTokAdSetsSubtable } from "@/app/(app)/tiktok/_components/tiktok-ad-sets-subtable"
import type { CampaignAdSetRow } from "@/lib/services/meta/types"

type FetchCampaignAdSetsAction = typeof getCampaignAdSets

type DisplayColumnId = AdSetSubtableColumnId | TikTokAdSetManageColumnId

interface CampaignAdSetsExpandedRowProps {
  campaignId: string
  campaignObjective: string
  columnVisibility: VisibilityState
  visibleColumnOrder: string[]
  queryKeyPrefix?: string
  fetchAdSets?: FetchCampaignAdSetsAction
  currency?: CurrencyCode
  enableTikTokManage?: boolean
  enableMetaExtendedMetrics?: boolean
  prefetchedAdSets?: CampaignAdSetRow[]
  adSetPerformanceFilter?: CampaignPerformanceFilter
}

const SKELETON_ROWS = 3

function getSubtableHeadClassName(
  columnId: DisplayColumnId,
  currency: CurrencyCode
) {
  const meta = getAdSetSubtableColumnMeta(columnId, currency)

  return cn(
    columnId === "name" && "w-[300px] pl-5",
    columnId === "active" && "w-[52px]",
    columnId !== "name" && columnId !== "active" && "text-right",
    meta.align === "left" && "text-left"
  )
}

function getSubtableCellClassName(
  columnId: DisplayColumnId,
  currency: CurrencyCode
) {
  const meta = getAdSetSubtableColumnMeta(columnId, currency)

  return cn(
    columnId === "name" && "pl-5",
    columnId === "active" && "text-center",
    columnId !== "name" && columnId !== "active" && "text-right",
    meta.align === "left" && "text-left"
  )
}

export function CampaignAdSetsExpandedRow({
  campaignId,
  campaignObjective,
  columnVisibility,
  visibleColumnOrder,
  queryKeyPrefix = "campaign-adsets",
  fetchAdSets = getCampaignAdSets,
  currency = META_DASHBOARD_CURRENCY,
  enableTikTokManage = false,
  enableMetaExtendedMetrics = false,
  prefetchedAdSets,
  adSetPerformanceFilter,
}: CampaignAdSetsExpandedRowProps) {
  const usePurchaseLabels = enableTikTokManage || enableMetaExtendedMetrics
  const { dateRange } = useDateRange()
  const visibleSubtableColumns = getVisibleAdSetSubtableColumns(
    visibleColumnOrder,
    columnVisibility
  )
  const tiktokDisplayColumns = enableTikTokManage
    ? getTikTokAdSetDisplayColumns(visibleSubtableColumns)
    : null
  const displayColumns: (DisplayColumnId | TikTokAdSetDisplayColumnId)[] =
    tiktokDisplayColumns ??
    getAdSetSubtableColumnsWithTikTokManage(visibleSubtableColumns, false)

  const usePrefetched = prefetchedAdSets !== undefined

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [queryKeyPrefix, campaignId, dateRange, campaignObjective],
    queryFn: () =>
      runServerAction(
        fetchAdSets({ campaignId, dateRange, objective: campaignObjective })
      ),
    enabled: Boolean(campaignId) && !usePrefetched,
  })

  const rawAdSets = usePrefetched ? prefetchedAdSets : data

  const displayAdSets = useMemo(() => {
    if (!rawAdSets?.length) return rawAdSets ?? []
    if (
      !adSetPerformanceFilter ||
      adSetPerformanceFilter === "ALL" ||
      adSetPerformanceFilter === "ACTIVOS" ||
      adSetPerformanceFilter === "APAGADO"
    ) {
      return rawAdSets
    }
    return rawAdSets.filter(
      (adSet) =>
        getTikTokAdSetPerformanceStatus(adSet, currency) ===
          adSetPerformanceFilter && hasTikTokAdSetActivityInPeriod(adSet)
    )
  }, [adSetPerformanceFilter, currency, rawAdSets])

  if (displayColumns.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        No hay columnas visibles para mostrar los conjuntos.
      </p>
    )
  }

  const columnMetaFor = (columnId: DisplayColumnId | TikTokAdSetDisplayColumnId) =>
    enableTikTokManage
      ? getTikTokAdSetColumnMeta(columnId as TikTokAdSetDisplayColumnId, currency)
      : getAdSetSubtableColumnMeta(
          columnId as DisplayColumnId,
          currency,
          usePurchaseLabels
        )

  const headClassFor = (columnId: DisplayColumnId | TikTokAdSetDisplayColumnId) =>
    enableTikTokManage
      ? cn(
          columnId === "name" && "w-[300px] pl-5",
          columnId === "active" && "w-[52px]",
          columnId !== "name" && columnId !== "active" && "text-right",
          columnMetaFor(columnId).align === "left" && "text-left"
        )
      : getSubtableHeadClassName(columnId as DisplayColumnId, currency)

  const cellClassFor = (columnId: DisplayColumnId | TikTokAdSetDisplayColumnId) =>
    enableTikTokManage
      ? cn(
          columnId === "name" && "pl-5",
          columnId === "active" && "text-center",
          columnId !== "name" && columnId !== "active" && "text-right",
          columnMetaFor(columnId).align === "left" && "text-left"
        )
      : getSubtableCellClassName(columnId as DisplayColumnId, currency)

  if (!usePrefetched && isLoading) {
    return (
      <div className="py-1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {displayColumns.map((columnId) => (
                <TableHead
                  key={columnId}
                  className={headClassFor(columnId)}
                >
                  {columnMetaFor(columnId).label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {displayColumns.map((columnId) => (
                  <TableCell
                    key={`${rowIndex}-${columnId}`}
                    className={cellClassFor(columnId)}
                  >
                    <Skeleton
                      className={cn(
                        "h-4",
                        columnId === "name"
                          ? "w-48"
                          : columnId === "active"
                            ? "mx-auto h-6 w-10"
                            : "ml-auto w-16"
                      )}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (isError) {
    const rateLimit = error ? isMetaRateLimitError(error) : false
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-destructive">
            {rateLimit
              ? "Límite de Meta al cargar conjuntos."
              : "No se pudieron cargar los conjuntos."}
          </p>
          {error?.message ? (
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Reintentar carga de conjuntos"
        >
          <RiRefreshLine data-icon="inline-start" />
        </Button>
      </div>
    )
  }

  if (!displayAdSets.length) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        {adSetPerformanceFilter &&
        adSetPerformanceFilter !== "ALL" &&
        adSetPerformanceFilter !== "ACTIVOS" &&
        adSetPerformanceFilter !== "APAGADO"
          ? "Ningún conjunto con ese estado en el periodo."
          : "No hay conjuntos asociados."}
      </p>
    )
  }

  if (enableTikTokManage && tiktokDisplayColumns) {
    return (
      <TikTokAdSetsSubtable
        data={displayAdSets}
        displayColumns={tiktokDisplayColumns}
        currency={currency}
      />
    )
  }

  return (
    <MetaAdSetsSubtable
      data={displayAdSets}
      displayColumns={displayColumns as AdSetSubtableColumnId[]}
      currency={currency}
    />
  )
}
