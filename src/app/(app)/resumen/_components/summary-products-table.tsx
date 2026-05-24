"use client"

import Image from "next/image"
import Link from "next/link"
import { RiFacebookCircleFill, RiImageLine, RiTiktokFill } from "@remixicon/react"
import { useQuery } from "@tanstack/react-query"
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
import { formatCurrency } from "@/lib/format"
import type { DateRange } from "@/lib/services/meta/types"
import type {
  SummaryProductPlatformMetrics,
  SummaryProductTableRow,
} from "@/lib/services/summary/products-summary-table"
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import { getSummaryProductsTableAction } from "../_actions/summary-products-table"
import {
  formatSummaryCpa,
  formatSummaryOrders,
  formatSummarySpendCop,
} from "./summary-pin-card"

interface SummaryProductsTableSectionProps {
  dateRange: DateRange
}

function formatPlatformSpend(
  metrics: SummaryProductPlatformMetrics | null,
  currency: "COP" | "PEN"
): string {
  if (!metrics || metrics.spend <= 0) return "—"
  return formatCurrency(metrics.spend, currency)
}

function formatPlatformPurchases(
  metrics: SummaryProductPlatformMetrics | null
): string {
  if (!metrics || metrics.purchases <= 0) return "—"
  return formatSummaryOrders(metrics.purchases)
}

function formatPlatformCpa(
  metrics: SummaryProductPlatformMetrics | null,
  currency: "COP" | "PEN"
): string {
  if (!metrics || metrics.cpa <= 0) return "—"
  return formatSummaryCpa(metrics.cpa, currency)
}

function MetricCells({
  metrics,
  currency,
}: {
  metrics: SummaryProductPlatformMetrics | null
  currency: "COP" | "PEN"
}) {
  return (
    <>
      <TableCell className="text-right text-xs tabular-nums sm:text-sm">
        {formatPlatformSpend(metrics, currency)}
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums sm:text-sm">
        {formatPlatformPurchases(metrics)}
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums sm:text-sm">
        {formatPlatformCpa(metrics, currency)}
      </TableCell>
    </>
  )
}

function ProductRow({ row }: { row: SummaryProductTableRow }) {
  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="min-w-[10rem] whitespace-normal py-3">
        <Link
          href={`/producto/${row.id}`}
          className="flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border bg-muted sm:size-12">
            {row.imageUrl ? (
              <Image
                src={row.imageUrl}
                alt={row.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <RiImageLine className="size-5 opacity-50" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{row.name}</p>
            {row.campaignCount > 0 ? (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {row.campaignCount === 1
                  ? "1 campaña"
                  : `${row.campaignCount} campañas`}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Sin campañas
              </p>
            )}
          </div>
        </Link>
      </TableCell>
      <MetricCells metrics={row.meta} currency="COP" />
      <MetricCells metrics={row.tiktok} currency="PEN" />
      <TableCell
        className={cn(
          "text-right text-xs font-semibold tabular-nums sm:text-sm",
          row.total.purchases > 0 && "text-emerald-700 dark:text-emerald-400"
        )}
      >
        {row.total.purchases > 0
          ? formatSummaryOrders(row.total.purchases)
          : "—"}
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums sm:text-sm">
        {row.total.spendCop > 0
          ? formatSummarySpendCop(row.total.spendCop)
          : "—"}
      </TableCell>
    </TableRow>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

export function SummaryProductsTableSection({
  dateRange,
}: SummaryProductsTableSectionProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["summary-products-table", dateRange],
    queryFn: () => runServerAction(getSummaryProductsTableAction(dateRange)),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const rowsWithCampaigns =
    data?.rows.filter((row) => row.campaignCount > 0) ?? []

  const totalVentas = rowsWithCampaigns.reduce(
    (sum, row) => sum + row.total.purchases,
    0
  )
  const totalGastoCop = rowsWithCampaigns.reduce(
    (sum, row) => sum + row.total.spendCop,
    0
  )

  return (
    <section className="flex flex-col gap-3 sm:gap-4">
      {isError ? (
        <p className="text-sm text-destructive">
          {error?.message ?? "No se pudo cargar la tabla de productos."}
        </p>
      ) : null}

      {isLoading ? (
        <TableSkeleton />
      ) : data ? (
        rowsWithCampaigns.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No hay productos con campañas vinculadas. Configúralas en{" "}
            <Link href="/producto" className="font-medium text-foreground underline">
              Producto
            </Link>
            .
          </p>
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    rowSpan={2}
                    className="min-w-[10rem] align-bottom text-xs sm:text-sm"
                  >
                    Producto
                  </TableHead>
                  <TableHead
                    colSpan={3}
                    className="border-l text-center text-xs sm:text-sm"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <RiFacebookCircleFill className="size-3.5 text-blue-600" />
                      Facebook
                    </span>
                  </TableHead>
                  <TableHead
                    colSpan={3}
                    className="border-l text-center text-xs sm:text-sm"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <RiTiktokFill className="size-3.5" />
                      TikTok
                    </span>
                  </TableHead>
                  <TableHead
                    colSpan={2}
                    className="border-l text-center text-xs font-semibold sm:text-sm"
                  >
                    Total
                  </TableHead>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="border-l text-right text-[11px] sm:text-xs">
                    Gasto
                  </TableHead>
                  <TableHead className="text-right text-[11px] sm:text-xs">
                    Ventas
                  </TableHead>
                  <TableHead className="text-right text-[11px] sm:text-xs">
                    CPA
                  </TableHead>
                  <TableHead className="border-l text-right text-[11px] sm:text-xs">
                    Gasto
                  </TableHead>
                  <TableHead className="text-right text-[11px] sm:text-xs">
                    Ventas
                  </TableHead>
                  <TableHead className="text-right text-[11px] sm:text-xs">
                    CPA
                  </TableHead>
                  <TableHead className="border-l text-right text-[11px] sm:text-xs">
                    Ventas
                  </TableHead>
                  <TableHead className="text-right text-[11px] sm:text-xs">
                    Gasto
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsWithCampaigns.map((row) => (
                  <ProductRow key={row.id} row={row} />
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell
                    colSpan={7}
                    className="py-3 text-sm font-semibold"
                  >
                    Total
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {totalVentas > 0
                      ? formatSummaryOrders(totalVentas)
                      : "—"}
                  </TableCell>
                  <TableCell className="py-3 text-right text-sm font-semibold tabular-nums">
                    {totalGastoCop > 0
                      ? formatSummarySpendCop(totalGastoCop)
                      : "—"}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )
      ) : null}
    </section>
  )
}
