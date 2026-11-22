"use client"

import { cn } from "@/lib/utils"
import { formatDashboardDayShort } from "@/lib/date"
import type { MetaInformePayload } from "@/lib/services/meta/meta-operative-service"
import { ACCION_STYLE, moneyFormatter } from "./informe-format"

export function InformeSide({ data }: { data: MetaInformePayload }) {
  const money = moneyFormatter(data.account.currency)
  const maxSpend = Math.max(1, ...data.accountDays.map((d) => d.spend))
  const totalOn = data.estadoSummary.reduce((s, e) => s + e.count, 0)
  const spendOn = data.estadoSummary.reduce((s, e) => s + e.spendToday, 0)

  return (
    <aside className="bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-medium">
          Gasto por día · últimos {data.accountDays.length}
        </h3>
        <div
          className="mt-3 flex h-28 items-end gap-1.5"
          role="img"
          aria-label="Gasto de la cuenta por día"
        >
          {data.accountDays.map((day) => {
            const isToday = day.date === data.date
            return (
              <div
                key={day.date}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={`${formatDashboardDayShort(day.date)} · ${money(day.spend)} · ${day.purchases} compras`}
              >
                <span
                  className={cn(
                    "w-full rounded-t-[3px]",
                    isToday ? "bg-foreground" : "bg-blue-500/80"
                  )}
                  style={{
                    height: `${Math.max(2, (day.spend / maxSpend) * 100)}%`,
                  }}
                />
                <span className="text-muted-foreground text-[10px] tabular-nums">
                  {isToday ? "hoy" : day.date.slice(8)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">
          Estado de {totalOn} conjunto{totalOn === 1 ? "" : "s"} ON
        </h3>
        {data.estadoSummary.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Ningún conjunto encendido con gasto en el periodo.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {data.estadoSummary.map((entry) => {
              const style = ACCION_STYLE[entry.accion]
              const share = spendOn > 0 ? (entry.spendToday / spendOn) * 100 : 0
              return (
                <li
                  key={entry.accion}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      style.pill
                    )}
                  >
                    {style.label}
                  </span>
                  <span className="tabular-nums">{entry.count}</span>
                  <span className="text-muted-foreground w-24 text-right text-xs tabular-nums">
                    {Math.round(share)}% del gasto
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
