"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CampaignAdSetRow } from "@/lib/services/meta/types"
import type { CurrencyCode } from "@/lib/format"
import { cn } from "@/lib/utils"
import { SortableHeader } from "@/app/(app)/dashboard/_components/campaigns/sortable-header"
import {
  isTikTokAdSetManageColumnId,
  renderAdSetSubtableCell,
  type AdSetSubtableColumnId,
  type TikTokAdSetManageColumnId,
} from "@/app/(app)/dashboard/_components/campaigns/ad-set-subtable-columns"
import { TikTokBudgetCell } from "./tiktok-budget-cell"
import { TikTokDuplicateAdGroupButton } from "./tiktok-duplicate-adgroup-button"
import { TikTokStatusSwitch } from "./tiktok-status-switch"
import {
  getTikTokAdSetColumnMeta,
  isTikTokAdSetEstadoColumnId,
  isTikTokAdSetMetricColumnId,
  renderTikTokAdSetEstadoCell,
  renderTikTokAdSetMetricCell,
  type TikTokAdSetDisplayColumnId,
  type TikTokAdSetMetricColumnId,
} from "./tiktok-ad-set-columns"

/** Sticky solo en Act. / Estado / Nombre (Presupuesto no se fija). */
const STICKY_ADSET_COLUMNS = {
  active: { left: "left-0", z: "z-[5]", width: "w-[52px] min-w-[52px]" },
  estado: {
    left: "left-[52px]",
    z: "z-[4]",
    width: "w-[88px] min-w-[88px]",
  },
  name: {
    left: "left-[140px]",
    z: "z-[3]",
    width: "w-[220px] min-w-[220px] max-w-[220px]",
  },
} as const

type StickyAdSetColumnId = keyof typeof STICKY_ADSET_COLUMNS

function isStickyAdSetColumnId(
  columnId: string
): columnId is StickyAdSetColumnId {
  return columnId in STICKY_ADSET_COLUMNS
}

function getStickyAdSetClassName(columnId: TikTokAdSetDisplayColumnId) {
  if (!isStickyAdSetColumnId(columnId)) return undefined
  const sticky = STICKY_ADSET_COLUMNS[columnId]
  return cn("sticky bg-transparent", sticky.left, sticky.z, sticky.width)
}

function getSubtableHeadClassName(
  columnId: TikTokAdSetDisplayColumnId,
  currency: CurrencyCode
) {
  const meta = getTikTokAdSetColumnMeta(columnId, currency)

  return cn(
    getStickyAdSetClassName(columnId),
    columnId === "name" && "pl-5",
    columnId === "budget" && "w-[96px] min-w-[96px]",
    columnId === "duplicate" && "w-[44px] min-w-[44px]",
    columnId !== "name" &&
      columnId !== "active" &&
      columnId !== "estado" &&
      columnId !== "duplicate" &&
      "text-right",
    meta.align === "left" && "text-left"
  )
}

function getSubtableCellClassName(
  columnId: TikTokAdSetDisplayColumnId,
  currency: CurrencyCode
) {
  const meta = getTikTokAdSetColumnMeta(columnId, currency)

  return cn(
    getStickyAdSetClassName(columnId),
    columnId === "name" && "pl-5",
    columnId === "budget" && "w-[96px] min-w-[96px]",
    columnId === "duplicate" && "w-[44px] min-w-[44px]",
    (columnId === "active" ||
      columnId === "estado" ||
      columnId === "duplicate") &&
      "text-center",
    columnId !== "name" &&
      columnId !== "active" &&
      columnId !== "estado" &&
      columnId !== "duplicate" &&
      "text-right",
    meta.align === "left" && "text-left"
  )
}

function renderManageCell(
  columnId: TikTokAdSetManageColumnId,
  adSet: CampaignAdSetRow
) {
  const entity = {
    type: "adgroup" as const,
    id: adSet.id,
    name: adSet.name,
    status: adSet.status,
    campaignId: adSet.campaignId,
    dailyBudget: adSet.dailyBudget,
    budgetMode: adSet.budgetMode,
  }

  if (columnId === "active") {
    return <TikTokStatusSwitch entity={entity} />
  }

  if (columnId === "duplicate") {
    return (
      <TikTokDuplicateAdGroupButton
        adgroupId={adSet.id}
        adgroupName={adSet.name}
        campaignId={adSet.campaignId}
      />
    )
  }

  return <TikTokBudgetCell entity={entity} />
}

function metricAccessor(
  columnId: TikTokAdSetMetricColumnId,
  row: CampaignAdSetRow
): number {
  switch (columnId) {
    case "purchases7d":
      return row.purchases7d ?? 0
    case "cpa7d":
      return row.cpa7d ?? 0
    case "totalPurchases":
      return row.totalPurchases ?? 0
    case "totalCpa":
      return row.totalCpa ?? 0
  }
}

function buildColumnDef(
  columnId: TikTokAdSetDisplayColumnId,
  currency: CurrencyCode
): ColumnDef<CampaignAdSetRow> {
  const meta = getTikTokAdSetColumnMeta(columnId, currency)
  const align = meta.align === "left" ? "left" : "right"

  if (isTikTokAdSetManageColumnId(columnId)) {
    return {
      id: columnId,
      enableSorting: columnId === "budget",
      accessorFn:
        columnId === "budget"
          ? (row) => row.dailyBudget ?? 0
          : undefined,
      header:
        columnId === "budget"
          ? (context) => (
              <SortableHeader
                context={context}
                label={meta.label}
                align={align}
              />
            )
          : () => (
              <span className="text-sm font-semibold">
                {meta.label || "Dup."}
              </span>
            ),
      cell: ({ row }) => renderManageCell(columnId, row.original),
    }
  }

  if (isTikTokAdSetMetricColumnId(columnId)) {
    return {
      id: columnId,
      accessorFn: (row) => metricAccessor(columnId, row),
      header: (context) => (
        <SortableHeader context={context} label={meta.label} align={align} />
      ),
      cell: ({ row }) =>
        renderTikTokAdSetMetricCell(columnId, row.original, currency),
    }
  }

  if (isTikTokAdSetEstadoColumnId(columnId)) {
    return {
      id: columnId,
      header: () => <span className="text-sm font-semibold">{meta.label}</span>,
      cell: ({ row }) => renderTikTokAdSetEstadoCell(row.original, currency),
    }
  }

  const subtableId = columnId as AdSetSubtableColumnId

  return {
    id: columnId,
    accessorKey: columnId,
    header: (context) => (
      <SortableHeader
        context={context}
        label={meta.label}
        align={align}
        className={columnId === "name" ? "pl-2" : undefined}
      />
    ),
    cell: ({ row }) =>
      renderAdSetSubtableCell(subtableId, row.original, currency),
  }
}

interface TikTokAdSetsSubtableProps {
  data: CampaignAdSetRow[]
  displayColumns: TikTokAdSetDisplayColumnId[]
  currency: CurrencyCode
}

export function TikTokAdSetsSubtable({
  data,
  displayColumns,
  currency,
}: TikTokAdSetsSubtableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "spend", desc: true },
  ])

  const columns = React.useMemo(
    () => displayColumns.map((columnId) => buildColumnDef(columnId, currency)),
    [currency, displayColumns]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="min-w-0 w-full max-w-full py-1">
      {/* Sin scroll propio: el scroll horizontal lo maneja la tabla de campañas. */}
      <Table containerClassName="overflow-visible">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const columnId = header.column.id as TikTokAdSetDisplayColumnId
                return (
                  <TableHead
                    key={header.id}
                    className={getSubtableHeadClassName(columnId, currency)}
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
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => {
                const columnId = cell.column.id as TikTokAdSetDisplayColumnId
                return (
                  <TableCell
                    key={cell.id}
                    className={getSubtableCellClassName(columnId, currency)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
