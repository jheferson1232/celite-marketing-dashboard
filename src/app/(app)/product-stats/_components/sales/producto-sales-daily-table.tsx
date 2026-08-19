"use client"

import type { ReactNode } from "react"
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
import { formatCurrency, META_DASHBOARD_CURRENCY } from "@/lib/format"
import type { ProductDailyInsight } from "@/lib/services/product"
import { useProductoPlatformFilter } from "../../_lib/use-producto-platform-filter"
import { useProductoSalesHistory } from "../../_lib/use-producto-sales-history"

interface ProductoSalesDailyTableProps {
  productId: string
  campaignCount: number
}

function DailyTable({ days }: { days: ProductDailyInsight[] }) {
  if (days.length === 0) {
    return (
      <p className="px-2 py-3 text-xs text-muted-foreground">
        Sin datos en el período seleccionado.
      </p>
    )
  }

  const currency = META_DASHBOARD_CURRENCY
  const rows = days.toSorted((a, b) => b.date.localeCompare(a.date))

  return (
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
            Pedidos
          </TableHead>
          <TableHead className="sticky top-0 z-10 h-8 bg-background px-2 text-right text-xs">
            CPA
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((day) => (
          <TableRow key={day.date} className="hover:bg-muted/30">
            <TableCell className="px-2 py-1.5 text-xs font-medium">
              {format(parseISO(day.date), "EEE d MMM", { locale: es })}
            </TableCell>
            <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums">
              {formatCurrency(day.spend, currency)}
            </TableCell>
            <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums">
              {day.purchases}
            </TableCell>
            <TableCell className="px-2 py-1.5 text-right text-xs tabular-nums">
              {day.cpa > 0 ? formatCurrency(day.cpa, currency) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PlatformDailySection({
  icon,
  label,
  days,
}: {
  icon: ReactNode
  label: string
  days: ProductDailyInsight[]
}) {
  return (
    <section className="min-w-0 space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
      </div>
      <div className="max-h-[148px] overflow-hidden overflow-y-auto overscroll-y-contain rounded-md border [-webkit-overflow-scrolling:touch]">
        <DailyTable days={days} />
      </div>
    </section>
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
    return <Skeleton className="h-[220px] w-full rounded-md" />
  }

  if (isError || !data) {
    return (
      <p className="text-xs text-destructive">
        {error?.message ?? "No se pudo cargar la tabla."}
      </p>
    )
  }

  const showTikTok = platformFilter === "all" || platformFilter === "tiktok"
  const showMeta = platformFilter === "all" || platformFilter === "meta"
  const tiktokDays = data.tiktok?.days ?? []
  const metaDays = data.meta?.days ?? []

  if (
    (showTikTok ? tiktokDays.length : 0) +
      (showMeta ? metaDays.length : 0) ===
    0
  ) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin datos en el período seleccionado.
      </p>
    )
  }

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-xs font-medium">Por día</p>
      {showTikTok ? (
        <PlatformDailySection
          icon={<RiTiktokFill className="size-3.5" />}
          label="TikTok"
          days={tiktokDays}
        />
      ) : null}
      {showMeta ? (
        <PlatformDailySection
          icon={<RiFacebookCircleFill className="size-3.5 text-blue-600" />}
          label="Meta"
          days={metaDays}
        />
      ) : null}
    </div>
  )
}
