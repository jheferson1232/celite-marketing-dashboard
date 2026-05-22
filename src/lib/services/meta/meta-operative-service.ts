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
import { getAccountKpis } from "./account-kpis"
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
  dayCells: {
    date: string
    spend: number
    purchases: number
    points: number | null
    saleStatus: "green" | "red" | "neutral"
  }[]
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
  groups: InformeCampaignGroup[]
  /** Compat cron: filas con ⚠ Olvido (no activaste ayer). */
  forgotten: InformeEntityRow[]
  olvidoAlerts: InformeEntityRow[]
  /** Gasto ≥10k sin ventas (−1). */
  sinVentasAlerts: InformeEntityRow[]
  /** CPA &gt; 15k con ventas (−1). */
  cpaAltoAlerts: InformeEntityRow[]
  /** Conjunto ≥10k COP hoy sin compras (Telegram: apagar). */
  adsetsToPause: InformePauseItem[]
  /** Campaña ≥30k COP hoy sin compras (Telegram: apagar). */
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
  const spendingCampaignIds = new Set(campaignRows.map((c) => c.metaId))

  for (const adset of daily.adsets) {
    if (hasSpendOnAnyDate(adset, dateKeys) && adset.campaignMetaId) {
      spendingCampaignIds.add(adset.campaignMetaId)
    }
  }

  const campaignRowsAll = daily.campaigns.filter((c) =>
    spendingCampaignIds.has(c.metaId)
  )
  const adsetRows = daily.adsets.filter(
    (a) =>
      hasSpendOnAnyDate(a, dateKeys) &&
      a.campaignMetaId &&
      spendingCampaignIds.has(a.campaignMetaId)
  )

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

/** Sincroniza estado Meta + métricas solo para las entidades del informe (gasto hoy). */
export async function syncMetaOperativeStateForDate(
  date: string,
  metaIds: string[]
): Promise<void> {
  if (date < getMetaInformeStartDate() || metaIds.length === 0) return

  const { metaTrackEntity } = getInformePrisma()
  const entities = await metaTrackEntity.findMany({
    where: { metaId: { in: metaIds } },
  })
  if (entities.length === 0) return

  const activeByKey = await getInformeEntitiesActiveMap(entities)

  const range =
    date === getDashboardToday() ? getTodayDateRange() : { from: date, to: date }
  const daily = await getMetaAccountDailyInsights(range)

  const campaignDay = new Map(
    daily.campaigns.map((c) => [c.metaId, new Map(c.days.map((d) => [d.date, d]))])
  )
  const adsetDay = new Map(
    daily.adsets.map((a) => [a.metaId, new Map(a.days.map((d) => [d.date, d]))])
  )

  const isToday = date === getDashboardToday()
  const prevDate = addDaysToDateString(date, -1)
  const entityIds = entities.map((e) => e.id)

  const { metaOperativeDay } = getInformePrisma()
  const [existingTodayRows, prevRows] = await Promise.all([
    metaOperativeDay.findMany({
      where: { date, entityId: { in: entityIds } },
    }),
    metaOperativeDay.findMany({
      where: { date: prevDate, entityId: { in: entityIds } },
    }),
  ])
  const existingByEntity = new Map(existingTodayRows.map((r) => [r.entityId, r]))
  const prevByEntity = new Map(
    prevRows.map((r) => [
      r.entityId,
      {
        spend: r.spend,
        purchases: r.purchases,
        metaWasActive: r.metaWasActive,
        sold: r.sold,
      },
    ])
  )

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
    const existing = existingByEntity.get(entity.id)
    const metaWasActive = isToday
      ? liveActive
      : (existing?.metaWasActive ?? liveActive)

    const prev: OperativeSnapshot = prevByEntity.get(entity.id) ?? {
      spend: 0,
      purchases: 0,
      metaWasActive: true,
      sold: false,
    }

    const snapshot = buildDaySnapshot(spend, purchases, metaWasActive, prev)
    await upsertOperativeDay(entity.id, date, snapshot)
  }

  const kpis = await getAccountKpis({ from: date, to: date })
  await upsertInformeAccountDay(date, kpis.totalSpend, kpis.purchases)
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

  const [daily, accountKpis] = await Promise.all([
    getMetaAccountDailyInsights(dateRange),
    getAccountKpis(getTodayDateRange()),
  ])

  const { campaignRows, adsetRows, trackInputs } = collectSpendingInRange(
    daily,
    dateKeys
  )
  const metaIds = [...new Set(trackInputs.map((t) => t.metaId))]

  await upsertTrackEntitiesBatch(trackInputs)
  await pruneStaleTrackEntities(metaIds)

  if (metaIds.length > 0) {
    for (const d of dateKeys) {
      await syncMetaOperativeStateForDate(d, metaIds)
    }
  }

  const metaIdSet = new Set(metaIds)
  if (metaIdSet.size === 0) {
    return {
      date: today,
      informeStartDate,
      dateRange,
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
      today,
      storedByEntityDate,
      campaignDaily,
      adsetDaily
    )

    const adsets = adsetRows
      .filter((a) => a.campaignMetaId === cRow.metaId)
      .sort((a, b) => spendOnDate(b, today) - spendOnDate(a, today))
      .map((aRow) => {
        const adset = entityByKey.get(`adset:${aRow.metaId}`)
        if (!adset) return null
        return buildInformeRow(
          adset,
          dateKeys,
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
