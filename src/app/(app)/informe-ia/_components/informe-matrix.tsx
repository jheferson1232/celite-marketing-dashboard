"use client"

import { Fragment, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { RiArrowDownSLine, RiArrowRightSLine } from "@remixicon/react"
import { cn } from "@/lib/utils"
import { formatDashboardDayLong } from "@/lib/date"
import { runServerAction } from "@/lib/server-action"
import type { CurrencyCode } from "@/lib/format"
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
import { getInformeAdsetAdsAction } from "../_actions/meta-informe"
import { ACCION_STYLE, compactMoney, moneyFormatter, TONE_CELL } from "./informe-format"

const ACTION_ACCIONES = new Set<InformeAccion>(["apagar", "revisar", "reactivar"])

type DayCellData = { date: string; spend: number; purchases: number }

type RowData = {
  key: string
  level: 0 | 1 | 2
  name: string
  isActive: boolean
  status: React.ReactNode
  spendPeriod: number
  cpaPeriod: number
  dayCells: DayCellData[]
}

function Pill({ accion, text }: { accion: InformeAccion; text?: string }) {
  const style = ACCION_STYLE[accion]
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        style.pill
      )}
    >
      {text ?? style.label}
    </span>
  )
}

function CampaignStatus({ group }: { group: InformeCampaignGroup }) {
  const urgent = (Object.entries(group.accionCounts) as [InformeAccion, number][])
    .filter(([accion]) => ACTION_ACCIONES.has(accion))
    .sort((a, b) => INFORME_ACCION_ORDER[a[0]] - INFORME_ACCION_ORDER[b[0]])[0]
  if (urgent) {
    return (
      <Pill
        accion={urgent[0]}
        text={`${urgent[1]} ${ACCION_STYLE[urgent[0]].label.toLowerCase()}`}
      />
    )
  }
  return <Pill accion={group.campaign.accion} />
}

function DayCell({
  cell,
  target,
  currency,
}: {
  cell: DayCellData | undefined
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
          <span className="block text-[10px] opacity-80">{purchases} c</span>
        </>
      )}
    </td>
  )
}

function MatrixRow({
  row,
  data,
  expanded,
  onToggle,
}: {
  row: RowData
  data: MetaInformePayload
  expanded?: boolean
  onToggle?: () => void
}) {
  const money = moneyFormatter(data.account.currency)
  const stickyBg =
    row.level === 0 ? "bg-muted" : row.level === 1 ? "bg-card" : "bg-muted/30"
  return (
    <tr className={cn(row.level === 0 && "bg-muted/50 font-medium", row.level === 2 && "bg-muted/20")}>
      <td
        className={cn(
          "sticky left-0 z-[1] max-w-[300px] border-b py-1.5 pr-2 text-xs",
          stickyBg,
          row.level === 0 ? "pl-1" : row.level === 1 ? "pl-5" : "pl-10"
        )}
      >
        <div className="flex min-w-0 items-center gap-1">
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={expanded ? "Contraer" : "Desplegar"}
              className="text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5"
            >
              {expanded ? (
                <RiArrowDownSLine className="size-4" />
              ) : (
                <RiArrowRightSLine className="size-4" />
              )}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          {!row.isActive ? (
            <span className="text-muted-foreground shrink-0" title="Apagado">
              ○
            </span>
          ) : null}
          <span className="truncate" title={row.name}>
            {row.level === 2 ? <span className="text-muted-foreground">Anuncio · </span> : null}
            {row.name}
          </span>
        </div>
      </td>
      <td className="border-b px-2 py-1.5">{row.status}</td>
      <td className="border-b px-2 py-1.5 text-right text-xs tabular-nums">
        {money(row.spendPeriod)}
      </td>
      <td className="border-b px-2 py-1.5 text-right text-xs tabular-nums">
        {row.cpaPeriod > 0 ? money(row.cpaPeriod) : "—"}
      </td>
      {data.dateKeys.map((date) => (
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

function entityRow(row: InformeEntityRow, level: 0 | 1, status: React.ReactNode): RowData {
  return {
    key: row.entityId,
    level,
    name: row.name,
    isActive: row.metaWasActive,
    status,
    spendPeriod: row.spendInformeTotal,
    cpaPeriod: row.cpaInformeTotal,
    dayCells: row.dayCells,
  }
}

function AdRows({ data, adsetId }: { data: MetaInformePayload; adsetId: string }) {
  const accountId = data.account.accountId
  const adsQuery = useQuery({
    queryKey: ["meta-informe-adset-ads", accountId, adsetId],
    queryFn: () => runServerAction(getInformeAdsetAdsAction({ accountId, adsetId })),
    staleTime: 5 * 60 * 1000,
  })
  const colSpan = 4 + data.dateKeys.length

  if (adsQuery.isLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-muted-foreground border-b py-2 pl-12 text-xs">
          Cargando anuncios…
        </td>
      </tr>
    )
  }
  if (adsQuery.isError) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-destructive border-b py-2 pl-12 text-xs">
          {adsQuery.error instanceof Error ? adsQuery.error.message : "No se pudieron cargar los anuncios."}
        </td>
      </tr>
    )
  }
  const ads = adsQuery.data ?? []
  if (ads.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-muted-foreground border-b py-2 pl-12 text-xs">
          Sin anuncios con gasto en el periodo.
        </td>
      </tr>
    )
  }
  return (
    <>
      {ads.map((ad) => (
        <MatrixRow
          key={ad.metaId}
          data={data}
          row={{
            key: ad.metaId,
            level: 2,
            name: ad.name,
            isActive: ad.isActive,
            status: <Pill accion={ad.accion} />,
            spendPeriod: ad.spendPeriod,
            cpaPeriod: ad.cpaPeriod,
            dayCells: ad.dayCells,
          }}
        />
      ))}
    </>
  )
}

/** Campañas con algo pasando hoy arrancan desplegadas. */
function startsExpanded(group: InformeCampaignGroup): boolean {
  return group.adsets.some(
    (a) => a.metaWasActive || a.spendToday > 0 || ACTION_ACCIONES.has(a.accion)
  )
}

export function InformeMatrix({ data }: { data: MetaInformePayload }) {
  const [onlyOn, setOnlyOn] = useState(false)
  const [onlyActions, setOnlyActions] = useState(false)
  const [campaignOverride, setCampaignOverride] = useState<Record<string, boolean>>({})
  const [openAdsets, setOpenAdsets] = useState<Set<string>>(() => new Set())

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

  const isCampaignOpen = (group: InformeCampaignGroup) =>
    campaignOverride[group.campaign.entityId] ?? startsExpanded(group)

  const toggleAdset = (metaId: string) =>
    setOpenAdsets((prev) => {
      const next = new Set(prev)
      if (next.has(metaId)) next.delete(metaId)
      else next.add(metaId)
      return next
    })

  const allOpen = groups.length > 0 && groups.every(isCampaignOpen)
  const setAllCampaigns = (open: boolean) =>
    setCampaignOverride(
      Object.fromEntries(groups.map((g) => [g.campaign.entityId, open]))
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
        <button type="button" aria-pressed={onlyOn} className={toggleClass(onlyOn)} onClick={() => setOnlyOn((v) => !v)}>
          Solo ON
        </button>
        <button type="button" aria-pressed={onlyActions} className={toggleClass(onlyActions)} onClick={() => setOnlyActions((v) => !v)}>
          Solo con acción
        </button>
        <button type="button" className={toggleClass(false)} onClick={() => setAllCampaigns(!allOpen)}>
          {allOpen ? "Contraer campañas" : "Desplegar campañas"}
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
          <span>«c» = compras · ○ = apagado · ▸ conjunto = ver anuncios</span>
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
                  Campaña / conjunto / anuncio
                </th>
                <th className="border-b px-2 py-2 text-left font-medium">Estado hoy</th>
                <th className="border-b px-2 py-2 text-right font-medium">Gasto periodo</th>
                <th className="border-b px-2 py-2 text-right font-medium">CPA periodo</th>
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
              {groups.map((group) => {
                const open = isCampaignOpen(group)
                return (
                  <Fragment key={group.campaign.entityId}>
                    <MatrixRow
                      data={data}
                      row={entityRow(group.campaign, 0, <CampaignStatus group={group} />)}
                      expanded={open}
                      onToggle={() =>
                        setCampaignOverride((prev) => ({
                          ...prev,
                          [group.campaign.entityId]: !open,
                        }))
                      }
                    />
                    {open
                      ? group.adsets.map((adset) => {
                          const adsOpen = openAdsets.has(adset.metaId)
                          return (
                            <Fragment key={adset.entityId}>
                              <MatrixRow
                                data={data}
                                row={entityRow(adset, 1, <Pill accion={adset.accion} />)}
                                expanded={adsOpen}
                                onToggle={() => toggleAdset(adset.metaId)}
                              />
                              {adsOpen ? <AdRows data={data} adsetId={adset.metaId} /> : null}
                            </Fragment>
                          )
                        })
                      : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
