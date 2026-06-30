"use client"

import type { ReactNode } from "react"
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

function formatMoney(value: number | null | undefined, currency: CurrencyCode) {
  return value != null ? formatCurrency(value, currency) : formatCurrency(0, currency)
}

function paymentBadge(health: TikTokAdAccountHealth) {
  if (health.billingMode === "postpaid") {
    return (
      <Badge variant="outline" className="border-sky-500/50 text-xs text-sky-700 dark:text-sky-300">
        Crédito postpago
      </Badge>
    )
  }
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

function MetricCell({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-muted-foreground mb-0.5 uppercase tracking-wide">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

export function TikTokAccountHealthMetrics({
  health,
  isLoading,
  currencyFallback,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
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
  const isPostpaid = health.billingMode === "postpaid"

  const availableLabel = isPostpaid
    ? formatMoney(health.creditAvailable, currency)
    : formatMoney(health.balance, currency)

  const consumedLabel = isPostpaid
    ? formatMoney(health.creditConsumed ?? health.monthSpend, currency)
    : null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {paymentBadge(health)}
        {health.paymentNote &&
        health.unpaidAmount == null &&
        health.paymentStatus !== "no_balance" &&
        !isPostpaid ? (
          <span className="text-muted-foreground text-xs">{health.paymentNote}</span>
        ) : null}
      </div>
      <div
        className={`grid max-w-5xl grid-cols-2 gap-3 rounded-xl border border-border/70 bg-card/50 p-3 sm:grid-cols-3 ${isPostpaid ? "lg:grid-cols-5" : "lg:grid-cols-3"}`}
      >
        <MetricCell
          label="Campañas activas"
          value={
            health.campaignCountsAvailable ? (
              <>
                {health.activeCampaigns}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  / {health.totalCampaigns}
                </span>
              </>
            ) : (
              "No disponible"
            )
          }
        />
        <MetricCell
          label="Gasto hoy"
          value={formatCurrency(health.todaySpend, currency)}
        />
        <MetricCell
          label={isPostpaid ? "Crédito disponible" : "Saldo disponible"}
          value={availableLabel}
        />
        {isPostpaid ? (
          <MetricCell label="Consumido (mes)" value={consumedLabel} />
        ) : null}
        {isPostpaid ? (
          <>
            <MetricCell
              label="Límite crédito"
              value={formatMoney(health.creditLimit, currency)}
            />
            <MetricCell
              label="Disponible real"
              value={formatMoney(health.creditAvailable, currency)}
            />
          </>
        ) : null}
      </div>
      {isPostpaid && health.creditLimit == null && health.creditAvailable == null ? (
        <p className="text-muted-foreground max-w-3xl text-xs">
          Consumo del mes según reportes de TikTok. El límite de crédito requiere
          permiso financiero en el Business Center.
        </p>
      ) : null}
    </div>
  )
}
