"use client"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, type CurrencyCode } from "@/lib/format"
import type { TikTokAdAccountHealth } from "@/lib/services/tiktok/account-health"

type Props = {
  health: TikTokAdAccountHealth | undefined
  isLoading: boolean
  currencyFallback: string | null
}

function toCurrencyCode(value: string | null | undefined): CurrencyCode {
  const upper = value?.trim().toUpperCase()
  if (upper === "COP") return "COP"
  if (upper === "MXN" || upper === "MX") return "MX"
  return "PEN"
}

function paymentBadge(health: TikTokAdAccountHealth) {
  if (health.paymentStatus === "unpaid") {
    return (
      <Badge variant="destructive" className="text-xs">
        Con deuda
      </Badge>
    )
  }
  if (health.paymentStatus === "no_balance") {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-xs text-amber-600 dark:text-amber-400">
        Sin saldo
      </Badge>
    )
  }
  if (health.paymentStatus === "ok") {
    return (
      <Badge variant="secondary" className="text-xs text-emerald-700 dark:text-emerald-400">
        Al día
      </Badge>
    )
  }
  return null
}

export function TikTokAccountHealthMetrics({
  health,
  isLoading,
  currencyFallback,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!health) {
    return (
      <p className="text-muted-foreground text-xs">
        No se pudieron cargar métricas operativas.
      </p>
    )
  }

  const currency = health.currency ?? toCurrencyCode(currencyFallback)

  const balanceLabel =
    health.balance != null
      ? formatCurrency(health.balance, currency)
      : "—"

  const unpaidLabel =
    health.unpaidAmount != null
      ? health.unpaidAmount > 0
        ? formatCurrency(health.unpaidAmount, currency)
        : "Sin deuda"
      : health.paymentNote ?? "No disponible"

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {paymentBadge(health)}
        {health.paymentNote && health.unpaidAmount == null ? (
          <span className="text-muted-foreground text-xs">{health.paymentNote}</span>
        ) : null}
      </div>
      <div className="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground mb-0.5 uppercase tracking-wide">
            Campañas activas
          </p>
          <p className="font-medium">
            {health.activeCampaigns}
            <span className="text-muted-foreground font-normal">
              {" "}
              / {health.totalCampaigns}
            </span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5 uppercase tracking-wide">
            Gasto hoy
          </p>
          <p className="font-medium">
            {formatCurrency(health.todaySpend, currency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5 uppercase tracking-wide">
            Saldo disponible
          </p>
          <p className="font-medium">{balanceLabel}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5 uppercase tracking-wide">
            Pendiente / deuda
          </p>
          <p className="font-medium">{unpaidLabel}</p>
        </div>
      </div>
    </div>
  )
}
