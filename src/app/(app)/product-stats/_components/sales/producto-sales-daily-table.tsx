"use client"

import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { RiFacebookCircleFill, RiTiktokFill } from "@remixicon/react"
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
  formatCurrency,
  META_DASHBOARD_CURRENCY,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { ProductDailyInsight } from "@/lib/services/product"
import { useProductoPlatformFilter } from "../../_lib/use-producto-platform-filter"
import { useProductoSalesHistory } from "../../_lib/use-producto-sales-history"

interface ProductoSalesDailyTableProps {
  productId: string
  campaignCount: number
}

function DailyTable({
  days,
  currency,
}: {
  days: ProductDailyInsight[]
  currency: CurrencyCode
}) {
  if (days.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin datos en el período seleccionado.
      </p>
    )
  }

  return (
    <div className="max-h-[150px] overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="sticky top-0 z-10 h-8 bg-background px-2 text-xs">
              Día
            </TableHead>
            <TableHead className="sticky top-0 z-10 h-8 bg-background px-2 text-right text-xs">
              Gasto
            </TableHead>
            <TableHead className="sticky top-0 z-10 h-8 bg-background px-2 text-right text-xs">
              Compr.
            </TableHead>
            <TableHead className="sticky top-0 z-10 h-8 bg-background px-2 text-right text-xs">
              CPA
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...days].reverse().map((day) => (
            <TableRow key={day.date} className="hover:bg-muted/30">
              <TableCell className="px-2 py-1.5 text-xs font-medium">
                {format(parseISO(day.date), "EEE d MMM", { locale: es })}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums">
                {day.spend > 0
                  ? formatCurrency(day.spend, currency)
                  : "—"}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums">
                {day.purchases > 0 ? day.purchases : "—"}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums">
                {day.cpa > 0 ? formatCurrency(day.cpa, currency) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function PlatformDailyTable({
  label,
  icon,
  days,
  currency,
}: {
  label: string
  icon: React.ReactNode
  days: ProductDailyInsight[]
  currency: CurrencyCode
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </div>
      <DailyTable days={days} currency={currency} />
    </div>
  )
}

export function ProductoSalesDailyTable({
  productId,
  campaignCount,
}: ProductoSalesDailyTableProps) {
  const { platformFilter } = useProductoPlatformFilter()
  const { data, isLoading, isError, error } = useProductoSalesHistory(
    productId,
    campaignCount
  )

  if (campaignCount === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Vincula campañas para ver el historial.
      </p>
    )
  }

  if (isLoading) {
    return <Skeleton className="h-[150px] w-full rounded-md" />
  }

  if (isError || !data) {
    return (
      <p className="text-xs text-destructive">
        {error?.message ?? "No se pudo cargar la tabla."}
      </p>
    )
  }

  const showTikTok =
    (platformFilter === "all" || platformFilter === "tiktok") && data.tiktok
  const showMeta =
    (platformFilter === "all" || platformFilter === "meta") && data.meta
  const showPlatformHeaders = platformFilter === "all"

  if (!showTikTok && !showMeta) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin datos en el período seleccionado.
      </p>
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <p className="text-xs font-medium">Por día</p>
      {showTikTok ? (
        showPlatformHeaders ? (
          <PlatformDailyTable
            label="TikTok"
            icon={<RiTiktokFill className="size-3.5" />}
            days={data.tiktok!.days}
            currency={TIKTOK_DASHBOARD_CURRENCY}
          />
        ) : (
          <DailyTable
            days={data.tiktok!.days}
            currency={TIKTOK_DASHBOARD_CURRENCY}
          />
        )
      ) : null}
      {showMeta ? (
        showPlatformHeaders ? (
          <PlatformDailyTable
            label="Meta"
            icon={
              <RiFacebookCircleFill className="size-3.5 text-blue-600" />
            }
            days={data.meta!.days}
            currency={META_DASHBOARD_CURRENCY}
          />
        ) : (
          <DailyTable
            days={data.meta!.days}
            currency={META_DASHBOARD_CURRENCY}
          />
        )
      ) : null}
    </div>
  )
}
