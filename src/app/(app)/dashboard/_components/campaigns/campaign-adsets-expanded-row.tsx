"use client"

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
import { cn } from "@/lib/utils"
import type {
  CampaignAdSetRow,
  DateRange,
} from "@/lib/services/meta/types"
import { useDateRange } from "../../_lib/use-date-range"
import { getCampaignAdSets } from "../../_actions/campaign-adsets"
import {
  getAdSetSubtableColumnMeta,
  getAdSetSubtableColumnsWithTikTokManage,
  getVisibleAdSetSubtableColumns,
  renderAdSetSubtableCell,
  type AdSetSubtableColumnId,
  type TikTokAdSetManageColumnId,
} from "./ad-set-subtable-columns"
import { TikTokAdSetsSubtable } from "@/app/(app)/tiktok/_components/tiktok-ad-sets-subtable"

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
}

const SKELETON_ROWS = 3

function getSubtableHeadClassName(columnId: DisplayColumnId) {
  const meta = getAdSetSubtableColumnMeta(columnId)

  return cn(
    columnId === "name" && "w-[300px] pl-5",
    columnId === "active" && "w-[52px]",
    columnId !== "name" && columnId !== "active" && "text-right",
    meta.align === "left" && "text-left"
  )
}

function getSubtableCellClassName(columnId: DisplayColumnId) {
  const meta = getAdSetSubtableColumnMeta(columnId)

  return cn(
    columnId === "name" && "pl-5",
    columnId === "active" && "text-center",
    columnId !== "name" && columnId !== "active" && "text-right",
    meta.align === "left" && "text-left"
  )
}

function renderDisplayCell(
  columnId: AdSetSubtableColumnId,
  adSet: CampaignAdSetRow,
  currency: CurrencyCode
) {
  return renderAdSetSubtableCell(columnId, adSet, currency)
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
}: CampaignAdSetsExpandedRowProps) {
  const { dateRange } = useDateRange()
  const visibleSubtableColumns = getVisibleAdSetSubtableColumns(
    visibleColumnOrder,
    columnVisibility
  )
  const displayColumns = getAdSetSubtableColumnsWithTikTokManage(
    visibleSubtableColumns,
    enableTikTokManage
  )

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: [queryKeyPrefix, campaignId, dateRange, campaignObjective],
    queryFn: () =>
      runServerAction(
        fetchAdSets({ campaignId, dateRange, objective: campaignObjective })
      ),
    enabled: Boolean(campaignId),
  })

  if (displayColumns.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        No hay columnas visibles para mostrar los conjuntos.
      </p>
    )
  }

  if (isLoading) {
    return (
      <div className="py-1">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {displayColumns.map((columnId) => (
                <TableHead
                  key={columnId}
                  className={getSubtableHeadClassName(columnId)}
                >
                  {getAdSetSubtableColumnMeta(columnId).label}
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
                    className={getSubtableCellClassName(columnId)}
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
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm text-destructive">
          No se pudieron cargar los conjuntos.
        </p>
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

  if (!data?.length) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        No hay conjuntos asociados.
      </p>
    )
  }

  if (enableTikTokManage) {
    return (
      <TikTokAdSetsSubtable
        data={data}
        displayColumns={displayColumns}
        currency={currency}
      />
    )
  }

  return (
    <div className="py-1">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {displayColumns.map((columnId) => (
              <TableHead
                key={columnId}
                className={getSubtableHeadClassName(columnId)}
              >
                {getAdSetSubtableColumnMeta(columnId).label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((adSet) => (
            <TableRow key={adSet.id}>
              {displayColumns.map((columnId) => (
                <TableCell
                  key={`${adSet.id}-${columnId}`}
                  className={getSubtableCellClassName(columnId)}
                >
                  {renderDisplayCell(
                    columnId as AdSetSubtableColumnId,
                    adSet,
                    currency
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
