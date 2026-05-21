"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  formatCurrency,
  META_DASHBOARD_CURRENCY,
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import { RiArrowUpLine, RiArrowDownLine } from "@remixicon/react"

interface SummaryPinCardProps {
  title: string
  icon: React.ReactNode
  value: string
  changePct?: number | null
  subtitle?: string
  valueClassName?: string
}

function formatChangePct(changePct: number | null): string | null {
  if (changePct === null) return null
  return `${Math.abs(changePct).toFixed(2).replace(".", ",")} %`
}

export function SummaryPinCard({
  title,
  icon,
  value,
  changePct = null,
  subtitle,
  valueClassName,
}: SummaryPinCardProps) {
  const isUp = changePct !== null && changePct >= 0
  const changeLabel = formatChangePct(changePct)

  return (
    <Card className="h-full gap-0 overflow-hidden border-border/60 py-0 shadow-sm">
      <CardContent className="flex h-full min-h-[7.5rem] flex-col justify-between gap-3 p-4 sm:min-h-[8rem] sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted sm:size-10">
              {icon}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-muted-foreground sm:text-base">
                {title}
              </p>
              {subtitle ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          {changeLabel ? (
            <div
              className={cn(
                "flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums sm:text-sm",
                isUp ? "text-emerald-600" : "text-red-600"
              )}
            >
              {isUp ? (
                <RiArrowUpLine className="size-3.5 sm:size-4" />
              ) : (
                <RiArrowDownLine className="size-3.5 sm:size-4" />
              )}
              {changeLabel}
            </div>
          ) : null}
        </div>

        <p
          className={cn(
            "text-xl font-bold tracking-tight tabular-nums sm:text-2xl lg:text-[1.65rem]",
            valueClassName
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function isDisplayableMetric(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

export function formatSummarySpendCop(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return `${formatCurrency(value, META_DASHBOARD_CURRENCY)} COP`
}

export function formatSummaryOrders(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("es-ES").format(Math.round(value))
}

export function formatSummaryCpa(
  value: number,
  currency: CurrencyCode
): string {
  if (!isDisplayableMetric(value)) return "—"
  const suffix = currency === "PEN" ? " PEN" : " COP"
  return `${formatCurrency(value, currency)}${suffix}`
}
