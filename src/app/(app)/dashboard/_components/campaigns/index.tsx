"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  META_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { CampaignAdSetRow, CampaignRow } from "@/lib/services/meta/types"
import { getCampaignAdSets } from "../../_actions/campaign-adsets"
import { CampaignAdSetsExpandedRow } from "./campaign-adsets-expanded-row"
import { CampaignDetailsSheet } from "./campaign-details-sheet"
import { CampaignStatusFilters } from "./campaign-status-filters"
import { getCampaignColumns } from "./columns"
import { ColumnVisibilityToggle } from "./column-visibility-toggle"
import { TableEmptyState } from "./table-empty-state"
import { TableErrorState } from "./table-error-state"
import { TableSkeleton } from "./table-skeleton"
import type {
  CampaignColumnMeta,
  CampaignPerformanceFilter,
  CampaignPerformanceStatus,
} from "./types"
import {
  META_CAMPAIGNS_COLUMN_VISIBILITY_KEY,
  META_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY,
  usePersistedColumnVisibility,
} from "./use-persisted-column-visibility"
import type { VisibilityState } from "@tanstack/react-table"
import {
  getCampaignPerformanceStatus,
  getTikTokAdSetPerformanceStatus,
  getTikTokCampaignPerformanceStatus,
  hasTikTokAdSetActivityInPeriod,
  isMetaCampaignActive,
  isTikTokCampaignActiveToday,
} from "./utils"

type FetchCampaignAdSetsAction = typeof getCampaignAdSets

interface CampaignsTableProps {
  data?: CampaignRow[]
  isLoading: boolean
  error?: Error | null
  currency?: CurrencyCode
  adSetsQueryKeyPrefix?: string
  fetchCampaignAdSets?: FetchCampaignAdSetsAction
  enableTikTokManage?: boolean
  enableMetaExtendedMetrics?: boolean
  showAllCampaignsFilter?: boolean
  /** Meta: chip «activos» (azul) y «apagadas» por interruptor de campaña. */
  showMetaActiveCampaignFilter?: boolean
  metaLandingUrlsLoading?: boolean
  extendedMetricsLoading?: boolean
  extendedMetricsError?: Error | null
  columnVisibilityStorageKey?: string
  defaultColumnVisibility?: VisibilityState
  /** TikTok: chips excelente/en curso/crítico por conjunto; activos/apagadas por campaña. */
  tikTokAdSetsByCampaignId?: Record<string, CampaignAdSetRow[]>
}

const EMPTY_DATA: CampaignRow[] = []

const EMPTY_STATUS_COUNTS: Record<CampaignPerformanceStatus, number> = {
  EXCELENTE: 0,
  EN_CURSO: 0,
  CRITICO: 0,
  APAGADO: 0,
}

export function CampaignsTable({
  data,
  isLoading,
  error = null,
  currency = META_DASHBOARD_CURRENCY,
  adSetsQueryKeyPrefix,
  fetchCampaignAdSets,
  enableTikTokManage = false,
  enableMetaExtendedMetrics = false,
  showAllCampaignsFilter = false,
  showMetaActiveCampaignFilter = false,
  metaLandingUrlsLoading = false,
  extendedMetricsLoading = false,
  extendedMetricsError = null,
  columnVisibilityStorageKey = META_CAMPAIGNS_COLUMN_VISIBILITY_KEY,
  defaultColumnVisibility = enableMetaExtendedMetrics
    ? META_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY
    : {},
  tikTokAdSetsByCampaignId,
}: CampaignsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [selectedPerformanceFilter, setSelectedPerformanceFilter] =
    React.useState<CampaignPerformanceFilter>("ALL")
  const [expandedCampaignIds, setExpandedCampaignIds] = React.useState<
    Set<string>
  >(() => new Set())
  const [detailsCampaign, setDetailsCampaign] =
    React.useState<CampaignRow | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false)
  const { columnVisibility, setColumnVisibility } =
    usePersistedColumnVisibility(
      columnVisibilityStorageKey,
      defaultColumnVisibility
    )
  const tableData = data ?? EMPTY_DATA

  const handleToggleAdSets = React.useCallback((campaignId: string) => {
    if (!campaignId) return

    setExpandedCampaignIds((current) => {
      const next = new Set(current)
      if (next.has(campaignId)) {
        next.delete(campaignId)
      } else {
        next.add(campaignId)
      }
      return next
    })
  }, [])

  const handleOpenDetails = React.useCallback((campaign: CampaignRow) => {
    setDetailsCampaign(campaign)
    setIsDetailsOpen(true)
  }, [])

  const performanceCountsAtAdSetLevel =
    enableTikTokManage && Boolean(tikTokAdSetsByCampaignId)

  const PERFORMANCE_ADSET_FILTERS: CampaignPerformanceStatus[] = [
    "EXCELENTE",
    "EN_CURSO",
    "CRITICO",
  ]

  const { statusCounts, activeCampaignCount, totalCampaignCount, filteredTableData } =
    React.useMemo(() => {
    const counts: Record<CampaignPerformanceStatus, number> = {
      ...EMPTY_STATUS_COUNTS,
    }

    const useOperationalFilters =
      enableTikTokManage || showMetaActiveCampaignFilter

    const rowsWithStatus = tableData.map((row) => {
      const isActiveToday = enableTikTokManage
        ? isTikTokCampaignActiveToday(row)
        : showMetaActiveCampaignFilter
          ? isMetaCampaignActive(row)
          : false
      const performanceStatus = enableTikTokManage
        ? getTikTokCampaignPerformanceStatus(row, currency)
        : getCampaignPerformanceStatus(row, currency)

      return {
        row,
        isActiveToday,
        performanceStatus,
      }
    })

    if (performanceCountsAtAdSetLevel && tikTokAdSetsByCampaignId) {
      for (const adSets of Object.values(tikTokAdSetsByCampaignId)) {
        for (const adSet of adSets) {
          const status = getTikTokAdSetPerformanceStatus(adSet, currency)
          if (status) {
            counts[status] += 1
          }
        }
      }
      for (const { isActiveToday } of rowsWithStatus) {
        if (!isActiveToday) {
          counts.APAGADO += 1
        }
      }
    } else if (useOperationalFilters) {
      for (const { isActiveToday, performanceStatus } of rowsWithStatus) {
        if (!isActiveToday) {
          counts.APAGADO += 1
        } else if (performanceStatus) {
          counts[performanceStatus] += 1
        }
      }
    } else {
      for (const { performanceStatus } of rowsWithStatus) {
        if (performanceStatus) {
          counts[performanceStatus] += 1
        }
      }
    }

    const activeCount = useOperationalFilters
      ? rowsWithStatus.filter(({ isActiveToday }) => isActiveToday).length
      : 0

    const campaignHasMatchingAdSet = (campaignId: string, filter: CampaignPerformanceStatus) => {
      const adSets = tikTokAdSetsByCampaignId?.[campaignId] ?? []
      return adSets.some(
        (adSet) =>
          getTikTokAdSetPerformanceStatus(adSet, currency) === filter &&
          hasTikTokAdSetActivityInPeriod(adSet)
      )
    }

    const filteredRows =
      selectedPerformanceFilter === "ALL"
        ? tableData
        : selectedPerformanceFilter === "ACTIVOS"
          ? rowsWithStatus
              .filter(({ isActiveToday }) => isActiveToday)
              .map(({ row }) => row)
          : selectedPerformanceFilter === "APAGADO" && useOperationalFilters
            ? rowsWithStatus
                .filter(({ isActiveToday }) => !isActiveToday)
                .map(({ row }) => row)
            : performanceCountsAtAdSetLevel &&
                PERFORMANCE_ADSET_FILTERS.includes(
                  selectedPerformanceFilter as CampaignPerformanceStatus
                )
              ? tableData.filter((row) =>
                  campaignHasMatchingAdSet(
                    row.id,
                    selectedPerformanceFilter as CampaignPerformanceStatus
                  )
                )
              : rowsWithStatus
                  .filter(
                    ({ performanceStatus }) =>
                      performanceStatus === selectedPerformanceFilter
                  )
                  .map(({ row }) => row)

    return {
      statusCounts: counts,
      activeCampaignCount: activeCount,
      totalCampaignCount: tableData.length,
      filteredTableData: filteredRows,
    }
  }, [
    currency,
    enableTikTokManage,
    performanceCountsAtAdSetLevel,
    showMetaActiveCampaignFilter,
    selectedPerformanceFilter,
    tableData,
    tikTokAdSetsByCampaignId,
  ])

  const visibleCampaignIds = React.useMemo(
    () => new Set(filteredTableData.map((row) => row.id)),
    [filteredTableData]
  )

  React.useEffect(() => {
    setExpandedCampaignIds((current) => {
      const next = new Set(
        [...current].filter((id) => visibleCampaignIds.has(id))
      )
      return next.size === current.size ? current : next
    })
  }, [visibleCampaignIds])

  React.useEffect(() => {
    if (
      !performanceCountsAtAdSetLevel ||
      !PERFORMANCE_ADSET_FILTERS.includes(
        selectedPerformanceFilter as CampaignPerformanceStatus
      )
    ) {
      return
    }

    setExpandedCampaignIds((current) => {
      const next = new Set(current)
      for (const row of filteredTableData) {
        if (row.id) {
          next.add(row.id)
        }
      }
      return next
    })
  }, [
    filteredTableData,
    performanceCountsAtAdSetLevel,
    selectedPerformanceFilter,
  ])

  const columns = React.useMemo(
    () =>
      getCampaignColumns({
        expandedCampaignIds,
        onToggleAdSets: handleToggleAdSets,
        onOpenDetails: handleOpenDetails,
        currency,
        enableTikTokManage,
        enableMetaExtendedMetrics,
        metaLandingUrlsLoading,
        extendedMetricsLoading,
      }),
    [
      currency,
      enableTikTokManage,
      enableMetaExtendedMetrics,
      metaLandingUrlsLoading,
      extendedMetricsLoading,
      expandedCampaignIds,
      handleToggleAdSets,
      handleOpenDetails,
    ]
  )

  const table = useReactTable({
    data: filteredTableData,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility(
        typeof updater === "function" ? updater(columnVisibility) : updater
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const visibleColumnsCount = Math.max(table.getVisibleLeafColumns().length, 1)
  const visibleColumnOrder = table
    .getVisibleLeafColumns()
    .map((column) => column.id)

  return (
    <div className="min-w-0 w-full max-w-full space-y-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <CampaignStatusFilters
          counts={statusCounts}
          selectedFilter={selectedPerformanceFilter}
          onFilterChange={setSelectedPerformanceFilter}
          showAllFilter={showAllCampaignsFilter || enableTikTokManage}
          showActiveFilter={enableTikTokManage || showMetaActiveCampaignFilter}
          activeCampaignCount={activeCampaignCount}
          totalCampaignCount={totalCampaignCount}
          apagadoMeansSwitchOff={
            enableTikTokManage || showMetaActiveCampaignFilter
          }
          performanceCountsAtAdSetLevel={performanceCountsAtAdSetLevel}
        />
        <ColumnVisibilityToggle table={table} />
      </div>

      {enableMetaExtendedMetrics && extendedMetricsError ? (
        <p className="text-destructive text-xs">
          No se pudieron cargar ventas 7d / totales:{" "}
          {extendedMetricsError.message}
        </p>
      ) : null}

      {enableMetaExtendedMetrics && extendedMetricsLoading ? (
        <p className="text-muted-foreground text-xs">
          Cargando ventas de los últimos 7 días y totales desde Meta…
        </p>
      ) : null}

      <div className="min-w-0 w-full max-w-full rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const isNameCol = header.column.id === "name"
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        isNameCol &&
                          "sticky left-0 z-[2] min-w-[12rem] max-w-[20rem] bg-background shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)] dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.4)]"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columnsCount={visibleColumnsCount} />
            ) : error ? (
              <TableErrorState
                columnsCount={visibleColumnsCount}
                error={error}
              />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableEmptyState columnsCount={visibleColumnsCount} />
            ) : (
              table.getRowModel().rows.map((row) => {
                const isExpanded = expandedCampaignIds.has(row.original.id)

                return (
                  <React.Fragment key={row.id}>
                    <TableRow className="group" aria-expanded={isExpanded}>
                      {row.getVisibleCells().map((cell) => {
                        const isNameCol = cell.column.id === "name"
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              isNameCol &&
                                "sticky left-0 z-[1] min-w-[12rem] max-w-[20rem] bg-background shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)] group-hover:bg-muted/50 group-aria-[expanded=true]:bg-muted/50 dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.4)]"
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                    {isExpanded && row.original.id ? (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell
                          colSpan={visibleColumnsCount}
                          className="p-0"
                        >
                          <CampaignAdSetsExpandedRow
                            campaignId={row.original.id}
                            campaignObjective={row.original.objective}
                            columnVisibility={columnVisibility}
                            visibleColumnOrder={visibleColumnOrder}
                            queryKeyPrefix={adSetsQueryKeyPrefix}
                            fetchAdSets={fetchCampaignAdSets}
                            currency={currency}
                            enableTikTokManage={enableTikTokManage}
                            enableMetaExtendedMetrics={enableMetaExtendedMetrics}
                            prefetchedAdSets={
                              tikTokAdSetsByCampaignId?.[row.original.id]
                            }
                            adSetPerformanceFilter={
                              performanceCountsAtAdSetLevel
                                ? selectedPerformanceFilter
                                : undefined
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CampaignDetailsSheet
        campaign={detailsCampaign}
        open={isDetailsOpen}
        platform={enableTikTokManage ? "tiktok" : "meta"}
        currency={currency}
        onOpenChange={(open) => {
          setIsDetailsOpen(open)
          if (!open) {
            setDetailsCampaign(null)
          }
        }}
      />
    </div>
  )
}
