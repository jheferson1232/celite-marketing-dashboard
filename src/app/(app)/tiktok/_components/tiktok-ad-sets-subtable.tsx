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
  getAdSetSubtableColumnMeta,
  isTikTokAdSetManageColumnId,
  renderAdSetSubtableCell,
  type AdSetSubtableColumnId,
  type TikTokAdSetManageColumnId,
} from "@/app/(app)/dashboard/_components/campaigns/ad-set-subtable-columns"
import { TikTokBudgetCell } from "./tiktok-budget-cell"
import { TikTokStatusSwitch } from "./tiktok-status-switch"

type DisplayColumnId = AdSetSubtableColumnId | TikTokAdSetManageColumnId

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

function renderManageCell(columnId: TikTokAdSetManageColumnId, adSet: CampaignAdSetRow) {
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

function buildColumnDef(
  columnId: DisplayColumnId,
  currency: CurrencyCode
): ColumnDef<CampaignAdSetRow> {
  const meta = getAdSetSubtableColumnMeta(columnId, currency)
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

  return {
    id: columnId,
    ...(columnId === "roas"
      ? { accessorFn: (row: CampaignAdSetRow) => row.addToCart ?? 0 }
      : { accessorKey: columnId }),
    header: (context) => (
      <SortableHeader
        context={context}
        label={meta.label}
        align={align}
        className={columnId === "name" ? "pl-2" : undefined}
      />
    ),
    cell: ({ row }) => renderAdSetSubtableCell(columnId, row.original, currency),
  }
}

interface TikTokAdSetsSubtableProps {
  data: CampaignAdSetRow[]
  displayColumns: DisplayColumnId[]
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
                const columnId = header.column.id as DisplayColumnId
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
                const columnId = cell.column.id as DisplayColumnId
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
