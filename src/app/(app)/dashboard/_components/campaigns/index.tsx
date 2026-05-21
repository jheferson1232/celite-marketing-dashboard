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
import type { CampaignRow } from "@/lib/services/meta/types"
import { getCampaignAdSets } from "../../_actions/campaign-adsets"
import { CampaignAdSetsExpandedRow } from "./campaign-adsets-expanded-row"
import { CampaignDetailsSheet } from "./campaign-details-sheet"
import { CampaignStatusFilters } from "./campaign-status-filters"
import { getCampaignColumns } from "./columns"
import { ColumnVisibilityToggle } from "./column-visibility-toggle"
import { TableEmptyState } from "./table-empty-state"
import { TableSkeleton } from "./table-skeleton"
import type {
  CampaignColumnMeta,
  CampaignPerformanceFilter,
  CampaignPerformanceStatus,
} from "./types"
import { usePersistedColumnVisibility } from "./use-persisted-column-visibility"
import {
  getCampaignPerformanceStatus,
  getTikTokCampaignPerformanceStatus,
  isTikTokCampaignActiveToday,
} from "./utils"

type FetchCampaignAdSetsAction = typeof getCampaignAdSets

interface CampaignsTableProps {
  data?: CampaignRow[]
  isLoading: boolean
  currency?: CurrencyCode
  adSetsQueryKeyPrefix?: string
  fetchCampaignAdSets?: FetchCampaignAdSetsAction
  enableTikTokManage?: boolean
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
  currency = META_DASHBOARD_CURRENCY,
  adSetsQueryKeyPrefix,
  fetchCampaignAdSets,
  enableTikTokManage = false,
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
    usePersistedColumnVisibility()
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

  const { statusCounts, activeCampaignCount, totalCampaignCount, filteredTableData } =
    React.useMemo(() => {
    const counts: Record<CampaignPerformanceStatus, number> = {
      ...EMPTY_STATUS_COUNTS,
    }

    const rowsWithStatus = tableData.map((row) => {
      const isActiveToday = enableTikTokManage
        ? isTikTokCampaignActiveToday(row)
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

    if (enableTikTokManage) {
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

    const activeCount = enableTikTokManage
      ? rowsWithStatus.filter(({ isActiveToday }) => isActiveToday).length
      : 0

    const filteredRows =
      selectedPerformanceFilter === "ALL"
        ? tableData
        : selectedPerformanceFilter === "ACTIVOS"
          ? rowsWithStatus
              .filter(({ isActiveToday }) => isActiveToday)
              .map(({ row }) => row)
          : selectedPerformanceFilter === "APAGADO" && enableTikTokManage
            ? rowsWithStatus
                .filter(({ isActiveToday }) => !isActiveToday)
                .map(({ row }) => row)
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
  }, [currency, enableTikTokManage, selectedPerformanceFilter, tableData])

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

  const columns = React.useMemo(
    () =>
      getCampaignColumns({
        expandedCampaignIds,
        onToggleAdSets: handleToggleAdSets,
        onOpenDetails: handleOpenDetails,
        currency,
        enableTikTokManage,
      }),
    [
      currency,
      enableTikTokManage,
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CampaignStatusFilters
          counts={statusCounts}
          selectedFilter={selectedPerformanceFilter}
          onFilterChange={setSelectedPerformanceFilter}
          showAllFilter={enableTikTokManage}
          showActiveFilter={enableTikTokManage}
          activeCampaignCount={activeCampaignCount}
          totalCampaignCount={totalCampaignCount}
          apagadoMeansSwitchOff={enableTikTokManage}
        />
        <ColumnVisibilityToggle table={table} />
      </div>

      <div
        className={
          enableTikTokManage
            ? "overflow-x-auto overscroll-x-contain rounded-lg border [-webkit-overflow-scrolling:touch]"
            : "rounded-lg border"
        }
      >
        <Table className={enableTikTokManage ? "min-w-[72rem] w-max" : undefined}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
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
            ) : table.getRowModel().rows.length === 0 ? (
              <TableEmptyState columnsCount={visibleColumnsCount} />
            ) : (
              table.getRowModel().rows.map((row) => {
                const isExpanded = expandedCampaignIds.has(row.original.id)

                return (
                  <React.Fragment key={row.id}>
                    <TableRow aria-expanded={isExpanded}>
                      {row.getVisibleCells().map((cell) => {
                        return (
                          <TableCell key={cell.id}>
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
