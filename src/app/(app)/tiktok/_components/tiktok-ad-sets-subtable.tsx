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
import { TikTokStatusSwitch } from "./tiktok-status-switch"
import {
  getTikTokAdSetColumnMeta,
  isTikTokAdSetMetricColumnId,
  renderTikTokAdSetMetricCell,
  type TikTokAdSetDisplayColumnId,
  type TikTokAdSetMetricColumnId,
} from "./tiktok-ad-set-columns"

function getSubtableHeadClassName(
  columnId: TikTokAdSetDisplayColumnId,
  currency: CurrencyCode
) {
  const meta = getTikTokAdSetColumnMeta(columnId, currency)

  return cn(
    columnId === "name" && "w-[300px] pl-5",
    columnId === "active" && "w-[52px]",
    columnId !== "name" && columnId !== "active" && "text-right",
    meta.align === "left" && "text-left"
  )
}

function getSubtableCellClassName(
  columnId: TikTokAdSetDisplayColumnId,
  currency: CurrencyCode
) {
  const meta = getTikTokAdSetColumnMeta(columnId, currency)

  return cn(
    columnId === "name" && "pl-5",
    columnId === "active" && "text-center",
    columnId !== "name" && columnId !== "active" && "text-right",
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
          : () => <span className="text-sm font-semibold">{meta.label}</span>,
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
    <div className="py-1">
      <Table>
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
