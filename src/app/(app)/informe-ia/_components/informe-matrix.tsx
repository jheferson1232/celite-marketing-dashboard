"use client"

import { Fragment, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { formatDashboardDayLong } from "@/lib/date"
import {
  informeDayTone,
  INFORME_ACCION_ORDER,
  type InformeAccion,
} from "@/lib/services/meta/meta-informe-rules"
import type {
  InformeCampaignGroup,
  InformeEntityRow,
  MetaInformePayload,
} from "@/lib/services/meta/meta-operative-service"
import type { CurrencyCode } from "@/lib/format"
import { ACCION_STYLE, compactMoney, moneyFormatter, TONE_CELL } from "./informe-format"

const ACTION_ACCIONES = new Set<InformeAccion>(["apagar", "revisar", "reactivar"])

function AccionPill({ accion }: { accion: InformeAccion }) {
  const style = ACCION_STYLE[accion]
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        style.pill
      )}
    >
      {style.label}
    </span>
  )
}

function CampaignSummaryPill({ group }: { group: InformeCampaignGroup }) {
  const entries = Object.entries(group.accionCounts) as [InformeAccion, number][]
  const urgent = entries
    .filter(([accion]) => ACTION_ACCIONES.has(accion))
    .sort((a, b) => INFORME_ACCION_ORDER[a[0]] - INFORME_ACCION_ORDER[b[0]])[0]
  if (urgent) {
    const style = ACCION_STYLE[urgent[0]]
    return (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
          style.pill
        )}
      >
        {urgent[1]} {style.label.toLowerCase()}
      </span>
    )
  }
  return <AccionPill accion={group.campaign.accion} />
}

function DayCell({
  cell,
  target,
  currency,
}: {
  cell: InformeEntityRow["dayCells"][number] | undefined
  target: number
  currency: CurrencyCode
}) {
  const spend = cell?.spend ?? 0
  const purchases = cell?.purchases ?? 0
  const tone = informeDayTone({ spend, purchases }, target)
  return (
    <td
      className={cn(
        "border-b px-1 py-1.5 text-center text-xs tabular-nums",
        TONE_CELL[tone]
      )}
    >
      {spend <= 0 ? (
        "—"
      ) : (
        <>
          {compactMoney(purchases > 0 ? spend / purchases : spend, currency)}
          <span className="block text-[10px] opacity-80">
            {purchases > 0 ? `${purchases} c` : "0 c"}
          </span>
        </>
      )}
    </td>
  )
}

function MatrixRow({
  row,
  dateKeys,
  data,
  isCampaign,
  group,
}: {
  row: InformeEntityRow
  dateKeys: string[]
  data: MetaInformePayload
  isCampaign: boolean
  group: InformeCampaignGroup
}) {
  const money = moneyFormatter(data.account.currency)
  return (
    <tr className={cn(isCampaign && "bg-muted/50 font-medium")}>
      <td
        className={cn(
          "sticky left-0 z-[1] max-w-[260px] truncate border-b px-2 py-1.5 text-xs",
          isCampaign ? "bg-muted" : "bg-card pl-5"
        )}
        title={row.name}
      >
        {!isCampaign && !row.metaWasActive ? (
          <span className="text-muted-foreground mr-1">○</span>
        ) : null}
        {row.name}
      </td>
      <td className="border-b px-2 py-1.5">
        {isCampaign ? (
          <CampaignSummaryPill group={group} />
        ) : (
          <AccionPill accion={row.accion} />
        )}
      </td>
      <td className="border-b px-2 py-1.5 text-right text-xs tabular-nums">
        {money(row.spendInformeTotal)}
      </td>
      <td className="border-b px-2 py-1.5 text-right text-xs tabular-nums">
        {row.cpaInformeTotal > 0 ? money(row.cpaInformeTotal) : "—"}
      </td>
      {dateKeys.map((date) => (
        <DayCell
          key={date}
          cell={row.dayCells.find((c) => c.date === date)}
          target={data.cpaTarget}
          currency={data.account.currency}
        />
      ))}
    </tr>
  )
}

export function InformeMatrix({ data }: { data: MetaInformePayload }) {
  const [onlyOn, setOnlyOn] = useState(false)
  const [onlyActions, setOnlyActions] = useState(false)

  const groups = useMemo(
    () =>
      data.groups
        .map((group) => ({
          ...group,
          adsets: group.adsets.filter(
            (adset) =>
              (!onlyOn || adset.metaWasActive) &&
              (!onlyActions || ACTION_ACCIONES.has(adset.accion))
          ),
        }))
        .filter((group) => group.adsets.length > 0 || (!onlyOn && !onlyActions)),
    [data.groups, onlyOn, onlyActions]
  )

  const toggleClass = (active: boolean) =>
    cn(
      "rounded-full border px-2.5 py-1 text-xs font-medium",
      active
        ? "border-foreground text-foreground"
        : "text-muted-foreground hover:text-foreground"
    )

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={onlyOn}
          className={toggleClass(onlyOn)}
          onClick={() => setOnlyOn((v) => !v)}
        >
          Solo ON
        </button>
        <button
          type="button"
          aria-pressed={onlyActions}
          className={toggleClass(onlyActions)}
          onClick={() => setOnlyActions((v) => !v)}
        >
          Solo con acción
        </button>
        <span className="text-muted-foreground ml-auto flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <i className="inline-block size-2.5 rounded-sm bg-emerald-500/40" />
            CPA ≤ objetivo
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block size-2.5 rounded-sm bg-amber-500/40" />
            1–1.5×
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block size-2.5 rounded-sm bg-red-500/40" />
            &gt; 1.5× o gasto sin compras
          </span>
          <span>«c» = compras · ○ = apagado</span>
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          Ningún conjunto con esos filtros.
        </p>
      ) : (
        <div className="bg-card min-w-0 overflow-x-auto rounded-xl border">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="text-muted-foreground text-[11px]">
                <th className="bg-card sticky left-0 z-[2] border-b px-2 py-2 text-left font-medium">
                  Campaña / conjunto
                </th>
                <th className="border-b px-2 py-2 text-left font-medium">Estado hoy</th>
                <th className="border-b px-2 py-2 text-right font-medium">
                  Gasto periodo
                </th>
                <th className="border-b px-2 py-2 text-right font-medium">
                  CPA periodo
                </th>
                {data.dateKeys.map((date) => (
                  <th
                    key={date}
                    className={cn(
                      "min-w-[58px] border-b px-1 py-2 text-center font-medium",
                      date === data.date && "text-foreground"
                    )}
                    title={formatDashboardDayLong(date)}
                  >
                    {date === data.date ? "Hoy" : date.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.campaign.entityId}>
                  <MatrixRow
                    row={group.campaign}
                    dateKeys={data.dateKeys}
                    data={data}
                    isCampaign
                    group={group}
                  />
                  {group.adsets.map((adset) => (
                    <MatrixRow
                      key={adset.entityId}
                      row={adset}
                      dateKeys={data.dateKeys}
                      data={data}
                      isCampaign={false}
                      group={group}
                    />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
