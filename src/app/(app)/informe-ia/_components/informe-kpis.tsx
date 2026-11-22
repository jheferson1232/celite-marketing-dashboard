"use client"

import { cn } from "@/lib/utils"
import { informeCpaTone } from "@/lib/services/meta/meta-informe-rules"
import type { MetaInformePayload } from "@/lib/services/meta/meta-operative-service"
import { moneyFormatter, TONE_TEXT } from "./informe-format"

function Kpi({
  label,
  value,
  sub,
  valueClassName,
  subClassName,
}: {
  label: string
  value: string
  sub: string
  valueClassName?: string
  subClassName?: string
}) {
  return (
    <div className="bg-card flex min-w-0 flex-col gap-0.5 p-3">
      <span className="text-muted-foreground truncate text-xs">{label}</span>
      <span
        className={cn(
          "truncate text-xl leading-7 font-semibold tabular-nums",
          valueClassName
        )}
      >
        {value}
      </span>
      <span className={cn("text-muted-foreground truncate text-xs", subClassName)}>
        {sub}
      </span>
    </div>
  )
}

function sumDays(days: MetaInformePayload["accountDays"]) {
  const spend = days.reduce((s, d) => s + d.spend, 0)
  const purchases = days.reduce((s, d) => s + d.purchases, 0)
  return { spend, purchases, cpa: purchases > 0 ? spend / purchases : 0 }
}

export function InformeKpis({ data }: { data: MetaInformePayload }) {
  const money = moneyFormatter(data.account.currency)
  const target = data.cpaTarget
  const yesterday = data.accountDays.find((d) => d.date === data.yesterday)
  const spendToday = data.accountSpendToday
  const purchasesToday = data.accountPurchasesToday
  const cpaToday = purchasesToday > 0 ? spendToday / purchasesToday : 0
  const period = sumDays(data.accountDays)

  const adsetsOn = data.estadoSummary.reduce((s, e) => s + e.count, 0)
  const pending = data.actions.filter((a) => a.accion !== "reactivar").length
  const purchasesDelta = purchasesToday - (yesterday?.purchases ?? 0)

  return (
    <div className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-5">
      <Kpi
        label="Gasto hoy"
        value={money(spendToday)}
        sub={`ayer ${money(yesterday?.spend ?? 0)}`}
      />
      <Kpi
        label="Compras hoy"
        value={String(purchasesToday)}
        sub={
          purchasesDelta === 0
            ? "igual que ayer"
            : `${purchasesDelta > 0 ? "▲" : "▼"} ${Math.abs(purchasesDelta)} vs ayer`
        }
        subClassName={
          purchasesDelta > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : purchasesDelta < 0
              ? "text-red-600 dark:text-red-400"
              : undefined
        }
      />
      <Kpi
        label={`CPA hoy · obj. ${money(target)}`}
        value={cpaToday > 0 ? money(cpaToday) : "—"}
        sub={cpaToday > 0 ? `${(cpaToday / target).toFixed(2)}× objetivo` : "sin compras aún"}
        valueClassName={TONE_TEXT[informeCpaTone(cpaToday, target)]}
      />
      <Kpi
        label={`CPA ${data.accountDays.length} días`}
        value={period.cpa > 0 ? money(period.cpa) : "—"}
        sub={`${period.purchases} compras · ${money(period.spend)}`}
        valueClassName={TONE_TEXT[informeCpaTone(period.cpa, target)]}
      />
      <Kpi
        label="Conjuntos ON"
        value={String(adsetsOn)}
        sub={
          pending > 0
            ? `${pending} con acción pendiente`
            : "ninguno para apagar o revisar"
        }
        subClassName={pending > 0 ? "text-red-600 dark:text-red-400" : undefined}
      />
    </div>
  )
}
