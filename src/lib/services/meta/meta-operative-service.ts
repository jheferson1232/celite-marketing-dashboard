import prisma from "@/lib/prisma"
import { getInformePrisma } from "@/lib/informe-db"
import {
  addDaysToDateString,
  getDashboardToday,
  getDashboardYesterday,
  getTodayDateRange,
} from "@/lib/date"
import {
  getMetaInformeDateKeys,
  getMetaInformeDateRange,
  getMetaInformeStartDate,
} from "@/lib/meta-informe"
import { formatCurrency, META_DASHBOARD_CURRENCY } from "@/lib/format"
import {
  getMetaAccountDailyInsights,
  type MetaDailyEntityRow,
  type MetaDailyMetricCell,
} from "./meta-account-daily-insights"
import { getAdsetsByCampaignMap } from "./adsets-catalog"
import { getInformeEntitiesActiveMap } from "./informe-entity-status"
import { getAccountKpis, getAccountKpisByDay } from "./account-kpis"
import { countAdSetsForCampaign } from "./meta-adset-count"
import { getMetaClient } from "./meta"
import { normalizeMetaId } from "./meta-ids"
import {
  collectAdsetsToPause,
  collectCampaignsToPause,
  type InformePauseItem,
} from "./meta-informe-alerts"
import {
  computeInformeScore,
  finalizePointsTotal,
  type InformeEstadoKind,
} from "./meta-informe-scoring"
import type { MetaAdSet } from "./types"

export type InformeEntityRow = {
  entityId: string
  metaId: string
  type: "campaign" | "adset"
  name: string
  campaignMetaId: string | null
  metaWasActive: boolean
  soldToday: boolean
  purchasesToday: number
  spendToday: number
  cpaToday: number
  /** Suma de puntos en el rango (ayer → hoy). */
  pointsTotal: number
  estadoKind: InformeEstadoKind
  estadoLabel: string
  notifyOlvido: boolean
  rowHighlight: "none" | "red"
  /** Suma desde inicio del informe (todas las fechas del rango). */
  spendInformeTotal: number
  purchasesInformeTotal: number
  cpaInformeTotal: number
  dayCells: {
    date: string
    spend: number
    purchases: number
    points: number | null
    saleStatus: "green" | "red" | "neutral"
  }[]
}

export function sumInformePeriodFromDayCells(
  dayCells: InformeEntityRow["dayCells"],
  onlyDates?: string[]
): {
  spendInformeTotal: number
  purchasesInformeTotal: number
  cpaInformeTotal: number
} {
  const allowed =
    onlyDates && onlyDates.length > 0 ? new Set(onlyDates) : null
  let spendInformeTotal = 0
  let purchasesInformeTotal = 0
  for (const cell of dayCells) {
    if (allowed && !allowed.has(cell.date)) continue
    spendInformeTotal += cell.spend
    purchasesInformeTotal += cell.purchases
  }
  return {
    spendInformeTotal,
    purchasesInformeTotal,
    cpaInformeTotal:
      purchasesInformeTotal > 0
        ? spendInformeTotal / purchasesInformeTotal
        : 0,
  }
}

export type InformeTableTotals = {
  spendToday: number
  purchasesToday: number
  cpaToday: number
  pointsTotal: number
  dayTotals: {
    date: string
    spend: number
    purchases: number
    points: number
  }[]
}

export type InformeCampaignGroup = {
  campaign: InformeEntityRow
  adsets: InformeEntityRow[]
  /** Total de conjuntos en la campaña (catálogo Meta). */
  adSetsCount: number
  /** Conjuntos con estado activo en Meta (misma regla que el dashboard). */
  activeAdSetsCount: number
}

export type MetaInformePayload = {
  date: string
  informeStartDate: string
  dateRange: { from: string; to: string }
  /** Columnas diarias en la tabla (desde informeStartDate hasta hoy). */
  dateKeys: string[]
  groups: InformeCampaignGroup[]
  /** Compat cron: filas con ⚠ Olvido (no activaste ayer). */
  forgotten: InformeEntityRow[]
  olvidoAlerts: InformeEntityRow[]
  /** Gasto ≥10k sin ventas (−1). */
  sinVentasAlerts: InformeEntityRow[]
  /** CPA &gt; 15k con ventas (−1). */
  cpaAltoAlerts: InformeEntityRow[]
  /** Conjunto ON ≥10k COP hoy sin compras (Telegram: apagar). */
  adsetsToPause: InformePauseItem[]
  /** Campaña ON ≥30k COP hoy sin compras (Telegram: apagar). */
  campaignsToPause: InformePauseItem[]
  yesterday: string
  totals: InformeTableTotals
  accountSpendToday: number
  accountPurchasesToday: number
}

type TrackEntityInput = {
  metaId: string
  type: "campaign" | "adset"
  name: string
  campaignMetaId: string | null
}

type OperativeSnapshot = {
  metaWasActive: boolean
  sold: boolean
  purchases: number
  spend: number
}

export type StoredOperativeDay = OperativeSnapshot & {
  cpa: number
  points: number | null
  estadoKind: InformeEstadoKind
  estadoLabel: string
  notifyOlvido: boolean
  rowHighlight: "none" | "red"
}

function saleStatusFromMetrics(
  spend: number,
  purchases: number
): InformeEntityRow["dayCells"][number]["saleStatus"] {
  if (purchases > 0) return "green"
  if (spend >= 30_000) return "red"
  return "neutral"
}

const UPSERT_CHUNK = 40

function spendOnDate(row: MetaDailyEntityRow, date: string): number {
  return row.days.find((d) => d.date === date)?.spend ?? 0
}

function hasSpendOnAnyDate(row: MetaDailyEntityRow, dateKeys: string[]): boolean {
  return dateKeys.some((d) => spendOnDate(row, d) > 0)
}

function collectSpendingInRange(
  daily: Awaited<ReturnType<typeof getMetaAccountDailyInsights>>,
  dateKeys: string[]
): {
  campaignRows: MetaDailyEntityRow[]
  adsetRows: MetaDailyEntityRow[]
  trackInputs: TrackEntityInput[]
} {
  const campaignRows = daily.campaigns.filter((c) =>
    hasSpendOnAnyDate(c, dateKeys)
  )
  const spendingCampaignIds = new Set(
    campaignRows.map((c) => normalizeMetaId(c.metaId))
  )

  for (const adset of daily.adsets) {
    const parentId = normalizeMetaId(adset.campaignMetaId ?? "")
    if (hasSpendOnAnyDate(adset, dateKeys) && parentId) {
      spendingCampaignIds.add(parentId)
    }
  }

  const campaignRowsAll = daily.campaigns.filter((c) =>
    spendingCampaignIds.has(normalizeMetaId(c.metaId))
  )
  const adsetRows = daily.adsets.filter((a) => {
    const parentId = normalizeMetaId(a.campaignMetaId ?? "")
    return (
      parentId &&
      spendingCampaignIds.has(parentId) &&
      hasSpendOnAnyDate(a, dateKeys)
    )
  })

  const trackInputs: TrackEntityInput[] = [
    ...campaignRowsAll.map((c) => ({
      metaId: c.metaId,
      type: "campaign" as const,
      name: c.name,
      campaignMetaId: null,
    })),
    ...adsetRows.map((a) => ({
      metaId: a.metaId,
      type: "adset" as const,
      name: a.name,
      campaignMetaId: a.campaignMetaId ?? null,
    })),
  ]

  return { campaignRows: campaignRowsAll, adsetRows, trackInputs }
}

async function upsertTrackEntitiesBatch(
  inputs: TrackEntityInput[]
): Promise<void> {
  if (inputs.length === 0) return
  const { metaTrackEntity } = getInformePrisma()

  for (let i = 0; i < inputs.length; i += UPSERT_CHUNK) {
    const chunk = inputs.slice(i, i + UPSERT_CHUNK)
    await prisma.$transaction(
      chunk.map((input) =>
        metaTrackEntity.upsert({
          where: { metaId_type: { metaId: input.metaId, type: input.type } },
          create: {
            metaId: input.metaId,
            type: input.type,
            name: input.name,
            campaignMetaId: input.campaignMetaId,
            objective: "",
          },
          update: {
            name: input.name,
            campaignMetaId: input.campaignMetaId,
          },
        })
      )
    )
  }
}

async function upsertOperativeDay(
  entityId: string,
  date: string,
  snapshot: StoredOperativeDay
) {
  const { metaOperativeDay } = getInformePrisma()
  await metaOperativeDay.upsert({
    where: { date_entityId: { date, entityId } },
    create: {
      date,
      entityId,
      intentActive: false,
      metaWasActive: snapshot.metaWasActive,
      sold: snapshot.sold,
      purchases: snapshot.purchases,
      spend: snapshot.spend,
      cpa: snapshot.cpa,
      points: snapshot.points,
      estadoKind: snapshot.estadoKind,
      estadoLabel: snapshot.estadoLabel,
      notifyOlvido: snapshot.notifyOlvido,
      rowHighlight: snapshot.rowHighlight,
    },
    update: {
      metaWasActive: snapshot.metaWasActive,
      sold: snapshot.sold,
      purchases: snapshot.purchases,
      spend: snapshot.spend,
      cpa: snapshot.cpa,
      points: snapshot.points,
      estadoKind: snapshot.estadoKind,
      estadoLabel: snapshot.estadoLabel,
      notifyOlvido: snapshot.notifyOlvido,
      rowHighlight: snapshot.rowHighlight,
    },
  })
}

async function upsertInformeAccountDay(
  date: string,
  accountSpend: number,
  accountPurchases: number
): Promise<void> {
  const { metaInformeAccountDay } = getInformePrisma()
  await metaInformeAccountDay.upsert({
    where: { date },
    create: { date, accountSpend, accountPurchases },
    update: { accountSpend, accountPurchases },
  })
}

function buildDaySnapshot(
  spend: number,
  purchases: number,
  metaWasActive: boolean,
  prev: OperativeSnapshot
): StoredOperativeDay {
  const cpa = purchases > 0 ? spend / purchases : 0
  const score = computeInformeScore({
    spendToday: spend,
    purchasesToday: purchases,
    cpaToday: cpa,
    yesterdaySpend: prev.spend,
  })
  return {
    spend,
    purchases,
    metaWasActive,
    sold: purchases > 0,
    cpa,
    points: score.points,
    estadoKind: score.estadoKind,
    estadoLabel: score.estadoLabel,
    notifyOlvido: false,
    rowHighlight: score.rowHighlight,
  }
}

type DailyDayMaps = {
  campaignDay: Map<string, Map<string, MetaDailyMetricCell>>
  adsetDay: Map<string, Map<string, MetaDailyMetricCell>>
}

function buildDailyDayMaps(
  daily: Awaited<ReturnType<typeof getMetaAccountDailyInsights>>
): DailyDayMaps {
  return {
    campaignDay: new Map(
      daily.campaigns.map((c) => [c.metaId, new Map(c.days.map((d) => [d.date, d]))])
    ),
    adsetDay: new Map(
      daily.adsets.map((a) => [a.metaId, new Map(a.days.map((d) => [d.date, d]))])
    ),
  }
}

function operativeRowToSnapshot(row: {
  spend: number
  purchases: number
  metaWasActive: boolean
  sold: boolean
}): OperativeSnapshot {
  return {
    spend: row.spend,
    purchases: row.purchases,
    metaWasActive: row.metaWasActive,
    sold: row.sold,
  }
}

/**
 * Persiste MetaOperativeDay usando insights ya cargados (sin repetir Graph API por día).
 * Una sola consulta de estados ON/OFF; KPIs de cuenta por día precargados.
 */
async function syncMetaOperativeStateBatch(
  dateKeys: string[],
  metaIds: string[],
  daily: Awaited<ReturnType<typeof getMetaAccountDailyInsights>>,
  accountKpisByDay: Map<string, { totalSpend: number; purchases: number }>
): Promise<void> {
  if (metaIds.length === 0 || dateKeys.length === 0) return

  const informeStart = getMetaInformeStartDate()
  const today = getDashboardToday()
  const { metaTrackEntity } = getInformePrisma()
  const entities = await metaTrackEntity.findMany({
    where: { metaId: { in: metaIds } },
  })
  if (entities.length === 0) return

  const activeByKey = await getInformeEntitiesActiveMap(entities)
  const { campaignDay, adsetDay } = buildDailyDayMaps(daily)
  const entityIds = entities.map((e) => e.id)

  const chronological = [...dateKeys].sort()
  const rangeFrom = chronological[0]!
  const rangeTo = chronological[chronological.length - 1]!

  const { metaOperativeDay } = getInformePrisma()
  const operativeRows = await metaOperativeDay.findMany({
    where: {
      entityId: { in: entityIds },
      date: { gte: addDaysToDateString(rangeFrom, -1), lte: rangeTo },
    },
  })

  const storedMetaWasActive = new Map(
    operativeRows.map((r) => [`${r.entityId}:${r.date}`, r.metaWasActive] as const)
  )
  const prevSnapshotByEntityDate = new Map<string, OperativeSnapshot>(
    operativeRows.map((r) => [
      `${r.entityId}:${r.date}`,
      operativeRowToSnapshot(r),
    ])
  )

  for (const date of chronological) {
    if (date < informeStart) continue

    const isToday = date === today
    const prevDate = addDaysToDateString(date, -1)

    for (const entity of entities) {
      const dayMap =
        entity.type === "campaign"
          ? campaignDay.get(entity.metaId)
          : adsetDay.get(entity.metaId)
      const cell = dayMap?.get(date)

      const spend = cell?.spend ?? 0
      const purchases = cell?.purchases ?? 0
      const liveActive =
        activeByKey.get(`${entity.type}:${entity.metaId}`) ?? false
      const metaWasActive = isToday
        ? liveActive
        : (storedMetaWasActive.get(`${entity.id}:${date}`) ?? true)

      const prev: OperativeSnapshot = prevSnapshotByEntityDate.get(
        `${entity.id}:${prevDate}`
      ) ?? {
        spend: 0,
        purchases: 0,
        metaWasActive: true,
        sold: false,
      }

      const snapshot = buildDaySnapshot(spend, purchases, metaWasActive, prev)
      await upsertOperativeDay(entity.id, date, snapshot)
      prevSnapshotByEntityDate.set(
        `${entity.id}:${date}`,
        operativeRowToSnapshot(snapshot)
      )
      storedMetaWasActive.set(`${entity.id}:${date}`, snapshot.metaWasActive)
    }

    const account = accountKpisByDay.get(date) ?? { totalSpend: 0, purchases: 0 }
    await upsertInformeAccountDay(date, account.totalSpend, account.purchases)
  }
}

/** Sincroniza un solo día (p. ej. pruebas); en producción usar el batch del informe. */
export async function syncMetaOperativeStateForDate(
  date: string,
  metaIds: string[]
): Promise<void> {
  if (date < getMetaInformeStartDate() || metaIds.length === 0) return

  const range = { from: date, to: date }
  const [daily, accountKpisByDay] = await Promise.all([
    getMetaAccountDailyInsights(range),
    getAccountKpisByDay(range),
  ])

  await syncMetaOperativeStateBatch([date], metaIds, daily, accountKpisByDay)
}

function getDailyCell(
  metaId: string,
  type: "campaign" | "adset",
  date: string,
  campaignDaily: Map<string, MetaDailyMetricCell[]>,
  adsetDaily: Map<string, MetaDailyMetricCell[]>
): MetaDailyMetricCell | undefined {
  const source =
    type === "campaign" ? campaignDaily.get(metaId) : adsetDaily.get(metaId)
  return source?.find((d) => d.date === date)
}

function getStoredDay(
  entityId: string,
  metaId: string,
  type: "campaign" | "adset",
  date: string,
  storedByEntityDate: Map<string, StoredOperativeDay>,
  campaignDaily: Map<string, MetaDailyMetricCell[]>,
  adsetDaily: Map<string, MetaDailyMetricCell[]>,
  prev: OperativeSnapshot
): StoredOperativeDay {
  const stored = storedByEntityDate.get(`${entityId}:${date}`)
  if (stored) return stored

  const cell = getDailyCell(metaId, type, date, campaignDaily, adsetDaily)
  const spend = cell?.spend ?? 0
  const purchases = cell?.purchases ?? 0
  return buildDaySnapshot(spend, purchases, false, prev)
}

function buildInformeRow(
  entity: {
    id: string
    metaId: string
    type: string
    name: string
    campaignMetaId: string | null
  },
  dateKeys: string[],
  yesterday: string,
  today: string,
  storedByEntityDate: Map<string, StoredOperativeDay>,
  campaignDaily: Map<string, MetaDailyMetricCell[]>,
  adsetDaily: Map<string, MetaDailyMetricCell[]>
): InformeEntityRow {
  const type = entity.type as "campaign" | "adset"
  const dayCells: InformeEntityRow["dayCells"] = []
  let pointsTotal = 0

  const emptyPrev: OperativeSnapshot = {
    spend: 0,
    purchases: 0,
    metaWasActive: true,
    sold: false,
  }

  for (const date of dateKeys) {
    const prevDate = addDaysToDateString(date, -1)
    const prevStored = storedByEntityDate.get(`${entity.id}:${prevDate}`)
    const prev: OperativeSnapshot = prevStored ?? emptyPrev

    const day = getStoredDay(
      entity.id,
      entity.metaId,
      type,
      date,
      storedByEntityDate,
      campaignDaily,
      adsetDaily,
      prev
    )
    dayCells.push({
      date,
      spend: day.spend,
      purchases: day.purchases,
      points: day.points,
      saleStatus: saleStatusFromMetrics(day.spend, day.purchases),
    })
    if (day.points !== null) pointsTotal += day.points
  }

  pointsTotal = finalizePointsTotal(dayCells, pointsTotal)
  const informePeriod = sumInformePeriodFromDayCells(dayCells)

  const todayDay =
    storedByEntityDate.get(`${entity.id}:${today}`) ??
    getStoredDay(
      entity.id,
      entity.metaId,
      type,
      today,
      storedByEntityDate,
      campaignDaily,
      adsetDaily,
      emptyPrev
    )

  return {
    entityId: entity.id,
    metaId: entity.metaId,
    type,
    name: entity.name,
    campaignMetaId: entity.campaignMetaId,
    metaWasActive: todayDay.metaWasActive,
    soldToday: todayDay.sold,
    purchasesToday: todayDay.purchases,
    spendToday: todayDay.spend,
    cpaToday: todayDay.cpa,
    pointsTotal,
    estadoKind: todayDay.estadoKind,
    estadoLabel: todayDay.estadoLabel,
    notifyOlvido: false,
    rowHighlight: todayDay.rowHighlight,
    ...informePeriod,
    dayCells,
  }
}

function computeInformeTotals(
  rows: InformeEntityRow[],
  dateKeys: string[],
  today: string
): InformeTableTotals {
  const adsetRows = rows.filter((r) => r.type === "adset")
  const spendToday = adsetRows.reduce((s, r) => s + r.spendToday, 0)
  const purchasesToday = adsetRows.reduce((s, r) => s + r.purchasesToday, 0)
  const pointsTotal = adsetRows.reduce((s, r) => s + r.pointsTotal, 0)
  const cpaToday =
    purchasesToday > 0 ? spendToday / purchasesToday : 0

  const dayTotals = dateKeys.map((date) => {
    let spend = 0
    let purchases = 0
    let points = 0
    for (const row of adsetRows) {
      const cell = row.dayCells.find((d) => d.date === date)
      if (!cell) continue
      spend += cell.spend
      purchases += cell.purchases
      points += cell.points ?? 0
    }
    return { date, spend, purchases, points }
  })

  return { spendToday, purchasesToday, cpaToday, pointsTotal, dayTotals }
}

async function pruneOperativeDaysBeforeInformeStart(): Promise<void> {
  try {
    const start = getMetaInformeStartDate()
    const { metaOperativeDay, metaInformeAccountDay } = getInformePrisma()
    await Promise.all([
      metaOperativeDay.deleteMany({ where: { date: { lt: start } } }),
      metaInformeAccountDay.deleteMany({ where: { date: { lt: start } } }),
    ])
  } catch {
    // Tablas aún no creadas en Neon o cliente desactualizado
  }
}

async function pruneStaleTrackEntities(keepMetaIds: string[]): Promise<void> {
  if (keepMetaIds.length === 0) return

  try {
    const { metaTrackEntity } = getInformePrisma()
    await metaTrackEntity.deleteMany({
      where: { metaId: { notIn: keepMetaIds } },
    })
  } catch {
    // Sin tablas o sin filas previas
  }
}

export async function getMetaInformePayload(): Promise<MetaInformePayload> {
  const today = getDashboardToday()
  const yesterday = getDashboardYesterday()
  const informeStartDate = getMetaInformeStartDate()
  const dateRange = getMetaInformeDateRange()
  const dateKeys = getMetaInformeDateKeys()

  await pruneOperativeDaysBeforeInformeStart()

  const [daily, accountKpis, accountKpisByDay] = await Promise.all([
    getMetaAccountDailyInsights(dateRange),
    getAccountKpis(getTodayDateRange()),
    getAccountKpisByDay(dateRange),
  ])

  const { campaignRows, adsetRows, trackInputs } = collectSpendingInRange(
    daily,
    dateKeys
  )
  const metaIds = [...new Set(trackInputs.map((t) => t.metaId))]

  await upsertTrackEntitiesBatch(trackInputs)
  await pruneStaleTrackEntities(metaIds)

  if (metaIds.length > 0) {
    await syncMetaOperativeStateBatch(
      dateKeys,
      metaIds,
      daily,
      accountKpisByDay
    )
  }

  const metaIdSet = new Set(metaIds)
  if (metaIdSet.size === 0) {
    return {
      date: today,
      informeStartDate,
      dateRange,
      dateKeys,
      groups: [],
      forgotten: [],
      olvidoAlerts: [],
      sinVentasAlerts: [],
      cpaAltoAlerts: [],
      adsetsToPause: [],
      campaignsToPause: [],
      yesterday,
      totals: {
        spendToday: 0,
        purchasesToday: 0,
        cpaToday: 0,
        pointsTotal: 0,
        dayTotals: dateKeys.map((date) => ({
          date,
          spend: 0,
          purchases: 0,
          points: 0,
        })),
      },
      accountSpendToday: accountKpis.totalSpend,
      accountPurchasesToday: accountKpis.purchases,
    }
  }

  const { metaTrackEntity, metaOperativeDay } = getInformePrisma()
  const [entities, operativeRows] = await Promise.all([
    metaTrackEntity.findMany({
      where: { metaId: { in: [...metaIdSet] } },
      orderBy: { name: "asc" },
    }),
    metaOperativeDay.findMany({
      where: { date: { gte: dateRange.from, lte: dateRange.to } },
    }),
  ])

  const storedByEntityDate = new Map<string, StoredOperativeDay>()
  for (const row of operativeRows) {
    storedByEntityDate.set(`${row.entityId}:${row.date}`, {
      spend: row.spend,
      purchases: row.purchases,
      metaWasActive: row.metaWasActive,
      sold: row.sold,
      cpa: row.cpa,
      points: row.points,
      estadoKind: row.estadoKind as InformeEstadoKind,
      estadoLabel: row.estadoLabel,
      notifyOlvido: row.notifyOlvido,
      rowHighlight: row.rowHighlight as StoredOperativeDay["rowHighlight"],
    })
  }

  const campaignDaily = new Map(daily.campaigns.map((c) => [c.metaId, c.days]))
  const adsetDaily = new Map(daily.adsets.map((a) => [a.metaId, a.days]))

  const entityByKey = new Map(
    entities.map((e) => [`${e.type}:${e.metaId}`, e] as const)
  )

  const groups: InformeCampaignGroup[] = []
  const allRows: InformeEntityRow[] = []

  const sortedCampaignRows = [...campaignRows].sort(
    (a, b) => spendOnDate(b, today) - spendOnDate(a, today)
  )

  const campaignMetaIds = sortedCampaignRows.map((c) => c.metaId)
  const adsetsByCampaign =
    campaignMetaIds.length > 0
      ? await getAdsetsByCampaignMap(getMetaClient(), campaignMetaIds)
      : new Map<string, MetaAdSet[]>()

  for (const cRow of sortedCampaignRows) {
    const campaign = entityByKey.get(`campaign:${cRow.metaId}`)
    if (!campaign) continue

    const campaignRow = buildInformeRow(
      campaign,
      dateKeys,
      yesterday,
      today,
      storedByEntityDate,
      campaignDaily,
      adsetDaily
    )

    const campaignId = normalizeMetaId(cRow.metaId)
    const adsets = adsetRows
      .filter(
        (a) => normalizeMetaId(a.campaignMetaId ?? "") === campaignId
      )
      .sort((a, b) => spendOnDate(b, today) - spendOnDate(a, today))
      .map((aRow) => {
        const adset = entityByKey.get(`adset:${aRow.metaId}`)
        if (!adset) return null
        return buildInformeRow(
          adset,
          dateKeys,
          yesterday,
          today,
          storedByEntityDate,
          campaignDaily,
          adsetDaily
        )
      })
      .filter((row): row is InformeEntityRow => row !== null)

    const catalogAdsets =
      adsetsByCampaign.get(normalizeMetaId(cRow.metaId)) ?? []
    const { total: adSetsCount, active: activeAdSetsCount } =
      countAdSetsForCampaign(catalogAdsets)

    groups.push({
      campaign: campaignRow,
      adsets,
      adSetsCount,
      activeAdSetsCount,
    })
    allRows.push(campaignRow, ...adsets)
  }

  const olvidoAlerts: InformeEntityRow[] = []
  const sinVentasAlerts = allRows.filter((r) => r.estadoKind === "sin_ventas")
  const cpaAltoAlerts = allRows.filter((r) => r.estadoKind === "cpa_alto")
  const adsetsToPause = collectAdsetsToPause(groups)
  const campaignsToPause = collectCampaignsToPause(groups)

  const totals = computeInformeTotals(allRows, dateKeys, today)

  return {
    date: today,
    informeStartDate,
    dateRange,
    dateKeys,
    groups,
    forgotten: olvidoAlerts,
    olvidoAlerts,
    sinVentasAlerts,
    cpaAltoAlerts,
    adsetsToPause,
    campaignsToPause,
    yesterday,
    totals,
    accountSpendToday: accountKpis.totalSpend,
    accountPurchasesToday: accountKpis.purchases,
  }
}

export type OlvidoNotificationItem = {
  type: "campaign" | "adset"
  name: string
  campaignName?: string
  estadoLabel: string
}

/** @deprecated Usar getOlvidoNotifications */
export type ForgottenActivationItem = OlvidoNotificationItem

/** @deprecated Regla de olvido eliminada; siempre vacío. */
export function mapOlvidoNotificationsFromInforme(
  _informe: MetaInformePayload
): OlvidoNotificationItem[] {
  return []
}

/** @deprecated Regla de olvido eliminada; siempre vacío. */
export async function getOlvidoNotifications(
  _date = getDashboardToday()
): Promise<OlvidoNotificationItem[]> {
  return []
}

export async function getForgottenActivations(
  date = getDashboardToday()
): Promise<OlvidoNotificationItem[]> {
  return getOlvidoNotifications(date)
}

export function formatCop(amount: number): string {
  return formatCurrency(amount, META_DASHBOARD_CURRENCY)
}
