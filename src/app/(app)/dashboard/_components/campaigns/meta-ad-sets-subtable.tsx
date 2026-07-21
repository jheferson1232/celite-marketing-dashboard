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
import { SortableHeader } from "./sortable-header"
import {
  getAdSetSubtableColumnMeta,
  renderAdSetSubtableCell,
  type AdSetSubtableColumnId,
} from "./ad-set-subtable-columns"

function getSubtableHeadClassName(
  columnId: AdSetSubtableColumnId,
  currency: CurrencyCode
) {
  const meta = getAdSetSubtableColumnMeta(columnId, currency, true)

  return cn(
    columnId === "name" &&
      "sticky left-0 z-[2] w-[300px] min-w-[12rem] max-w-[20rem] bg-muted pl-5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)] dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.4)]",
    columnId !== "name" && "text-right",
    meta.align === "left" && "text-left"
  )
}

function getSubtableCellClassName(
  columnId: AdSetSubtableColumnId,
  currency: CurrencyCode
) {
  const meta = getAdSetSubtableColumnMeta(columnId, currency, true)

  return cn(
    columnId === "name" &&
      "sticky left-0 z-[1] min-w-[12rem] max-w-[20rem] bg-muted/80 pl-5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)] group-hover:bg-muted dark:bg-muted/60 dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.4)]",
    columnId !== "name" && "text-right",
    meta.align === "left" && "text-left"
  )
}

function adSetSortValue(
  columnId: AdSetSubtableColumnId,
  row: CampaignAdSetRow
): number | string {
  switch (columnId) {
    case "name":
      return row.name.toLocaleLowerCase()
    case "spend":
      return row.spend
    case "impressions":
      return row.impressions
    case "ctr":
      return row.ctr
    case "cpc":
      return row.cpc
    case "results":
      return row.results
    case "costPerResult":
      return row.costPerResult
    case "leads":
      return row.leads ?? 0
    case "costPerLead":
      return row.costPerLead ?? 0
    case "roas":
      return row.addToCart ?? 0
    case "purchases7d":
      return row.purchases7d ?? 0
    case "cpa7d":
      return row.cpa7d ?? 0
    case "totalPurchases":
      return row.totalPurchases ?? 0
    case "totalSpend":
      return row.totalSpend ?? 0
    case "totalCpa":
      return row.totalCpa ?? 0
  }
}

function buildColumnDef(
  columnId: AdSetSubtableColumnId,
  currency: CurrencyCode
): ColumnDef<CampaignAdSetRow> {
  const meta = getAdSetSubtableColumnMeta(columnId, currency, true)
  const align = meta.align === "left" ? "left" : "right"

  return {
    id: columnId,
    accessorFn: (row) => adSetSortValue(columnId, row),
    header: (context) => (
      <SortableHeader
        context={context}
        label={meta.label}
        align={align}
        className={columnId === "name" ? "pl-2" : undefined}
      />
    ),
    cell: ({ row }) =>
      renderAdSetSubtableCell(columnId, row.original, currency, true),
  }
}

interface MetaAdSetsSubtableProps {
  data: CampaignAdSetRow[]
  displayColumns: AdSetSubtableColumnId[]
  currency: CurrencyCode
}

export function MetaAdSetsSubtable({
  data,
  displayColumns,
  currency,
}: MetaAdSetsSubtableProps) {
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
    <div className="min-w-0 w-full py-1">
      {/* Scroll propio: overflow-visible rompía el layout de la subtabla anidada. */}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const columnId = header.column.id as AdSetSubtableColumnId
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
            <TableRow key={row.id} className="group">
              {row.getVisibleCells().map((cell) => {
                const columnId = cell.column.id as AdSetSubtableColumnId
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
