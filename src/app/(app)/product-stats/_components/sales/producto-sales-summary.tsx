"use client"

import { RiFacebookCircleFill, RiTiktokFill } from "@remixicon/react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  formatCurrency,
  META_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { ProductPlatformSalesHistory } from "@/lib/services/product"
import { PRODUCT_STATS_TIKTOK_CURRENCY } from "../../_lib/producto-stats-currency"
import { useProductoSalesHistory } from "../../_lib/use-producto-sales-history"

interface ProductoSalesSummaryProps {
  productId: string
  campaignCount: number
}

function PlatformSummaryRow({
  label,
  icon,
  history,
  currency,
}: {
  label: string
  icon: React.ReactNode
  history: ProductPlatformSalesHistory
  currency: CurrencyCode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          label="Gasto"
          value={formatCurrency(history.totals.spend, currency)}
        />
        <SummaryCard
          label="Pedidos"
          value={String(history.totals.purchases)}
        />
        <SummaryCard
          label="CPA"
          value={
            history.totals.cpa > 0
              ? formatCurrency(history.totals.cpa, currency)
              : "—"
          }
        />
      </div>
    </div>
  )
}

export function ProductoSalesSummary({
  productId,
  campaignCount,
}: ProductoSalesSummaryProps) {
  const { data, isLoading, isError, error } = useProductoSalesHistory(
    productId,
    campaignCount
  )

  if (campaignCount === 0) return null

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <p className="text-xs text-destructive">
        {error?.message ?? "No se pudo cargar el resumen."}
      </p>
    )
  }

  const hasTikTok = data.tiktok !== null
  const hasMeta = data.meta !== null

  if (!hasTikTok && !hasMeta) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin datos en el período seleccionado.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {hasTikTok && data.tiktok ? (
        <PlatformSummaryRow
          label="TikTok"
          icon={<RiTiktokFill className="size-3.5" />}
          history={data.tiktok}
          currency={PRODUCT_STATS_TIKTOK_CURRENCY}
        />
      ) : null}
      {hasMeta && data.meta ? (
        <PlatformSummaryRow
          label="Meta"
          icon={
            <RiFacebookCircleFill className="size-3.5 text-blue-600" />
          }
          history={data.meta}
          currency={META_DASHBOARD_CURRENCY}
        />
      ) : null}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold tabular-nums">{value}</p>
    </div>
  )
}
