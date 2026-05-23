"use client"

import { RiFacebookCircleFill, RiTiktokFill } from "@remixicon/react"
import { Skeleton } from "@/components/ui/skeleton"
import { TikTokCampaignDetailsChart } from "@/app/(app)/tiktok/_components/tiktok-campaign-details-chart"
import {
  META_DASHBOARD_CURRENCY,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { ProductDailyInsight } from "@/lib/services/product"
import { useProductoPlatformFilter } from "../../_lib/use-producto-platform-filter"
import { useProductoSalesHistory } from "../../_lib/use-producto-sales-history"

interface ProductoSalesChartProps {
  productId: string
  campaignCount: number
}

function PlatformChart({
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
  if (days.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin datos en el período seleccionado.
      </p>
    )
  }

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label} · Gasto y compras
      </div>
      <TikTokCampaignDetailsChart
        days={days}
        currency={currency}
        className="h-[160px] w-full"
      />
    </div>
  )
}

export function ProductoSalesChart({
  productId,
  campaignCount,
}: ProductoSalesChartProps) {
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
    return <Skeleton className="h-[160px] w-full rounded-md" />
  }

  if (isError || !data) {
    return (
      <p className="text-xs text-destructive">
        {error?.message ?? "No se pudo cargar el gráfico."}
      </p>
    )
  }

  const showTikTok =
    (platformFilter === "all" || platformFilter === "tiktok") && data.tiktok
  const showMeta =
    (platformFilter === "all" || platformFilter === "meta") && data.meta

  if (!showTikTok && !showMeta) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin datos en el período seleccionado.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {showTikTok ? (
        <PlatformChart
          label="TikTok"
          icon={<RiTiktokFill className="size-3.5" />}
          days={data.tiktok!.days}
          currency={TIKTOK_DASHBOARD_CURRENCY}
        />
      ) : null}
      {showMeta ? (
        <PlatformChart
          label="Meta"
          icon={
            <RiFacebookCircleFill className="size-3.5 text-blue-600" />
          }
          days={data.meta!.days}
          currency={META_DASHBOARD_CURRENCY}
        />
      ) : null}
    </div>
  )
}
