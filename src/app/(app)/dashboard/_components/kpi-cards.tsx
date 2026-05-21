"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  formatCurrency,
  META_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { AccountKpis } from "@/lib/services/meta/types"
import { cn } from "@/lib/utils"

interface KpiCardsProps {
  data?: AccountKpis
  isLoading: boolean
  currency?: CurrencyCode
  /** Meta: agregados al carrito. TikTok: ROAS (por defecto). */
  lastMetric?: "roas" | "addToCart"
  className?: string
}

export function KpiCards({
  data,
  isLoading,
  currency = META_DASHBOARD_CURRENCY,
  lastMetric = "roas",
  className,
}: KpiCardsProps) {
  const formatNumber = (val: number) =>
    new Intl.NumberFormat("es-ES").format(val)
  const formatPercent = (val: number) => `${val.toFixed(2)}%`
  const formatMultiplier = (val: number) => `${val.toFixed(2)}x`

  const kpis = [
    {
      label: "GASTO TOTAL",
      value: data
        ? formatCurrency(data.totalSpend, currency)
        : formatCurrency(0, currency),
    },
    {
      label: "IMPRESIONES",
      value: data ? formatNumber(data.impressions) : "0",
    },
    { label: "CLICKS", value: data ? formatNumber(data.clicks) : "0" },
    { label: "CTR", value: data ? formatPercent(data.ctr) : "0.00%" },
    {
      label: "CPA",
      value: data
        ? formatCurrency(data.cpa, currency)
        : formatCurrency(0, currency),
    },
    {
      label: "CPM",
      value: data
        ? formatCurrency(data.cpm, currency)
        : formatCurrency(0, currency),
    },
    { label: "COMPRAS", value: data ? formatNumber(data.purchases) : "0" },
    lastMetric === "addToCart"
      ? {
          label: "AGREG. CARRITO",
          value: data ? formatNumber(data.addToCart ?? 0) : "0",
        }
      : {
          label: "ROAS",
          value: data ? formatMultiplier(data.roas) : "0.00x",
        },
  ]

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8",
        className
      )}
    >
      {kpis.map((kpi, i) => (
        <Card key={i} className="border-border/50 shadow-none" size="sm">
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {kpi.label}
            </span>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <span className="text-xl font-bold tracking-tight">
                {kpi.value}
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
