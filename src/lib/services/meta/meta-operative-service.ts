import prisma from "@/lib/prisma"
import { getDashboardToday, getTodayDateRange } from "@/lib/date"
import {
  getMetaInformeDateKeys,
  getMetaInformeDateRange,
  getMetaInformeStartDate,
} from "@/lib/meta-informe"
import { formatCurrency, META_DASHBOARD_CURRENCY } from "@/lib/format"
import { getCachedMetaCampaignCatalog } from "./campaign-catalog"
import { getCachedMetaAdsetsCatalog, normalizeAdSetFromApi } from "./adsets-catalog"
import { isMetaCampaignActiveForCount } from "./meta-campaign-status"
import { isMetaAdSetActiveForCount } from "./meta-adset-status"
import {
  getMetaAccountDailyInsights,
  type MetaDailyEntityRow,
} from "./meta-account-daily-insights"
import { getAccountKpis } from "./account-kpis"
import { getMetaClient } from "./meta"
import { normalizeMetaId } from "./meta-ids"
import type { MetaAdSet, MetaCampaign } from "./types"

export type InformeEntityRow = {
  entityId: string
  metaId: string
  type: "campaign" | "adset"
  name: string
  campaignMetaId: string | null
  intentActive: boolean
  metaWasActive: boolean
  forgotActivation: boolean
  soldToday: boolean
  purchasesToday: number
  spendToday: number
  dayCells: {
    date: string
    spend: number
    purchases: number
    saleStatus: "green" | "red" | "neutral"
  }[]
}

export type InformeCampaignGroup = {
  campaign: InformeEntityRow
  adsets: InformeEntityRow[]
}

export type MetaInformePayload = {
  date: string
  informeStartDate: string
  dateRange: { from: string; to: string }
  groups: InformeCampaignGroup[]
  forgotten: InformeEntityRow[]
  accountSpendToday: number
  accountPurchasesToday: number
}

type TrackEntityInput = {
  metaId: string
  type: "campaign" | "adset"
  name: string
  campaignMetaId: string | null
}

type MetaDailyMetricCell = InformeEntityRow["dayCells"][number]

const UPSERT_CHUNK = 40

function spendOnDate(row: MetaDailyEntityRow, date: string): number {
  return row.days.find((d) => d.date === date)?.spend ?? 0
}

function collectSpendingToday(
  daily: Awaited<ReturnType<typeof getMetaAccountDailyInsights>>,
  today: string
): {
  campaignRows: MetaDailyEntityRow[]
  adsetRows: MetaDailyEntityRow[]
  trackInputs: TrackEntityInput[]
} {
  const campaignRows = daily.campaigns.filter((c) => spendOnDate(c, today) > 0)
  const spendingCampaignIds = new Set(campaignRows.map((c) => c.metaId))

  for (const adset of daily.adsets) {
    if (spendOnDate(adset, today) > 0 && adset.campaignMetaId) {
      spendingCampaignIds.add(adset.campaignMetaId)
    }
  }

  const campaignRowsAll = daily.campaigns.filter((c) =>
    spendingCampaignIds.has(c.metaId)
  )
  const adsetRows = daily.adsets.filter(
    (a) =>
      spendOnDate(a, today) > 0 &&
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
  for (let i = 0; i < inputs.length; i += UPSERT_CHUNK) {
    const chunk = inputs.slice(i, i + UPSERT_CHUNK)
    await prisma.$transaction(
      chunk.map((input) =>
        prisma.metaTrackEntity.upsert({
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

function isCampaignActive(campaign: MetaCampaign): boolean {
  return isMetaCampaignActiveForCount(campaign)
}

function isAdsetActive(adset: MetaAdSet): boolean {
  return isMetaAdSetActiveForCount({
    status: adset.status,
    effective_status: adset.effective_status,
  })
}

async function upsertOperativeDay(
  entityId: string,
  date: string,
  patch: {
    metaWasActive?: boolean
    sold?: boolean
    purchases?: number
    spend?: number
  }
) {
  await prisma.metaOperativeDay.upsert({
    where: { date_entityId: { date, entityId } },
    create: {
      date,
      entityId,
      intentActive: false,
      metaWasActive: patch.metaWasActive ?? false,
      sold: patch.sold ?? false,
      purchases: patch.purchases ?? 0,
      spend: patch.spend ?? 0,
    },
    update: patch,
  })
}

/** Sincroniza estado Meta + métricas solo para las entidades del informe (gasto hoy). */
export async function syncMetaOperativeStateForDate(
  date: string,
  metaIds: string[]
): Promise<void> {
  if (date < getMetaInformeStartDate() || metaIds.length === 0) return

  const entities = await prisma.metaTrackEntity.findMany({
    where: { metaId: { in: metaIds } },
  })
  if (entities.length === 0) return

  const api = getMetaClient()
  const [campaigns, adsetsRaw] = await Promise.all([
    getCachedMetaCampaignCatalog(api),
    getCachedMetaAdsetsCatalog(api),
  ])

  const campaignById = new Map(
    campaigns.map((c) => [normalizeMetaId(c.id), c])
  )
  const adsetById = new Map<string, MetaAdSet>()
  for (const raw of adsetsRaw) {
    const adset = normalizeAdSetFromApi(
      raw as MetaAdSet & { campaign_id?: string | { id?: string } }
    )
    if (adset?.id) adsetById.set(adset.id, adset)
  }

  const range =
    date === getDashboardToday() ? getTodayDateRange() : { from: date, to: date }
  const daily = await getMetaAccountDailyInsights(range)

  const campaignDay = new Map(
    daily.campaigns.map((c) => [c.metaId, new Map(c.days.map((d) => [d.date, d]))])
  )
  const adsetDay = new Map(
    daily.adsets.map((a) => [a.metaId, new Map(a.days.map((d) => [d.date, d]))])
  )

  for (const entity of entities) {
    const dayMap =
      entity.type === "campaign"
        ? campaignDay.get(entity.metaId)
        : adsetDay.get(entity.metaId)
    const cell = dayMap?.get(date)

    let metaWasActive = false
    if (entity.type === "campaign") {
      const c = campaignById.get(entity.metaId)
      metaWasActive = c ? isCampaignActive(c) : false
    } else {
      const a = adsetById.get(entity.metaId)
      metaWasActive = a ? isAdsetActive(a) : false
    }

    await upsertOperativeDay(entity.id, date, {
      metaWasActive,
      sold: (cell?.purchases ?? 0) > 0,
      purchases: cell?.purchases ?? 0,
      spend: cell?.spend ?? 0,
    })
  }
}

export async function setMetaIntentActive(
  entityId: string,
  intentActive: boolean,
  date = getDashboardToday()
): Promise<void> {
  if (date < getMetaInformeStartDate()) return

  await prisma.metaOperativeDay.upsert({
    where: { date_entityId: { date, entityId } },
    create: {
      date,
      entityId,
      intentActive,
      metaWasActive: false,
      sold: false,
      purchases: 0,
      spend: 0,
    },
    update: { intentActive },
  })
}

function toInformeRow(
  entity: {
    id: string
    metaId: string
    type: string
    name: string
    campaignMetaId: string | null
  },
  operative: {
    intentActive: boolean
    metaWasActive: boolean
    sold: boolean
    purchases: number
    spend: number
  } | null,
  dayCells: InformeEntityRow["dayCells"]
): InformeEntityRow {
  const intentActive = operative?.intentActive ?? false
  const metaWasActive = operative?.metaWasActive ?? false
  return {
    entityId: entity.id,
    metaId: entity.metaId,
    type: entity.type as "campaign" | "adset",
    name: entity.name,
    campaignMetaId: entity.campaignMetaId,
    intentActive,
    metaWasActive,
    forgotActivation: intentActive && !metaWasActive,
    soldToday: operative?.sold ?? false,
    purchasesToday: operative?.purchases ?? 0,
    spendToday: operative?.spend ?? 0,
    dayCells,
  }
}

async function pruneOperativeDaysBeforeInformeStart(): Promise<void> {
  const start = getMetaInformeStartDate()
  await prisma.metaOperativeDay.deleteMany({ where: { date: { lt: start } } })
}

/** Quita entidades del catálogo completo antiguo; conserva gasto hoy o check «Activé». */
async function pruneStaleTrackEntities(
  keepMetaIds: string[],
  today: string
): Promise<void> {
  await prisma.metaTrackEntity.deleteMany({
    where: {
      metaId: { notIn: keepMetaIds },
      NOT: {
        operativeDays: {
          some: { date: today, intentActive: true },
        },
      },
    },
  })
}

function dayCellsForEntity(
  metaId: string,
  type: "campaign" | "adset",
  dateKeys: string[],
  campaignDaily: Map<string, MetaDailyMetricCell[]>,
  adsetDaily: Map<string, MetaDailyMetricCell[]>
): InformeEntityRow["dayCells"] {
  const source =
    type === "campaign" ? campaignDaily.get(metaId) : adsetDaily.get(metaId)
  const byDate = new Map(source?.map((d) => [d.date, d]))
  return dateKeys.map((date) => {
    const cell = byDate.get(date)
    return (
      cell ?? {
        date,
        spend: 0,
        purchases: 0,
        saleStatus: "neutral" as const,
      }
    )
  })
}

export async function getMetaInformePayload(): Promise<MetaInformePayload> {
  const today = getDashboardToday()
  const informeStartDate = getMetaInformeStartDate()
  const dateRange = getMetaInformeDateRange()
  const dateKeys = getMetaInformeDateKeys()

  await pruneOperativeDaysBeforeInformeStart()

  const [daily, accountKpis] = await Promise.all([
    getMetaAccountDailyInsights(dateRange),
    getAccountKpis(getTodayDateRange()),
  ])

  const { campaignRows, adsetRows, trackInputs } = collectSpendingToday(
    daily,
    today
  )
  const metaIds = [...new Set(trackInputs.map((t) => t.metaId))]

  await upsertTrackEntitiesBatch(trackInputs)
  await pruneStaleTrackEntities(metaIds, today)
  await syncMetaOperativeStateForDate(today, metaIds)

  const metaIdSet = new Set(metaIds)
  if (metaIdSet.size === 0) {
    return {
      date: today,
      informeStartDate,
      dateRange,
      groups: [],
      forgotten: [],
      accountSpendToday: accountKpis.totalSpend,
      accountPurchasesToday: accountKpis.purchases,
    }
  }

  const [entities, operativeRows] = await Promise.all([
    prisma.metaTrackEntity.findMany({
      where: { metaId: { in: [...metaIdSet] } },
      orderBy: { name: "asc" },
    }),
    prisma.metaOperativeDay.findMany({
      where: { date: { gte: dateRange.from, lte: dateRange.to } },
    }),
  ])

  const operativeByEntityDate = new Map<string, (typeof operativeRows)[0]>()
  for (const row of operativeRows) {
    operativeByEntityDate.set(`${row.entityId}:${row.date}`, row)
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

  for (const cRow of sortedCampaignRows) {
    const campaign = entityByKey.get(`campaign:${cRow.metaId}`)
    if (!campaign) continue
    const todayOp = operativeByEntityDate.get(`${campaign.id}:${today}`)
    const campaignRow = toInformeRow(
      campaign,
      todayOp ?? null,
      dayCellsForEntity(
        campaign.metaId,
        "campaign",
        dateKeys,
        campaignDaily,
        adsetDaily
      )
    )

    const adsets = adsetRows
      .filter((a) => a.campaignMetaId === cRow.metaId)
      .sort((a, b) => spendOnDate(b, today) - spendOnDate(a, today))
      .map((aRow) => {
        const adset = entityByKey.get(`adset:${aRow.metaId}`)
        if (!adset) return null
        const op = operativeByEntityDate.get(`${adset.id}:${today}`)
        return toInformeRow(
          adset,
          op ?? null,
          dayCellsForEntity(
            adset.metaId,
            "adset",
            dateKeys,
            campaignDaily,
            adsetDaily
          )
        )
      })
      .filter((row): row is InformeEntityRow => row !== null)

    groups.push({ campaign: campaignRow, adsets })
    allRows.push(campaignRow, ...adsets)
  }

  const forgotten = allRows.filter((r) => r.forgotActivation)

  return {
    date: today,
    informeStartDate,
    dateRange,
    groups,
    forgotten,
    accountSpendToday: accountKpis.totalSpend,
    accountPurchasesToday: accountKpis.purchases,
  }
}

export type ForgottenActivationItem = {
  type: "campaign" | "adset"
  name: string
  campaignName?: string
}

export async function getForgottenActivations(
  date = getDashboardToday()
): Promise<ForgottenActivationItem[]> {
  const informe = await getMetaInformePayload()
  return informe.forgotten.map((f) => {
    if (f.type === "campaign") {
      return { type: "campaign" as const, name: f.name }
    }
    const group = informe.groups.find((g) =>
      g.adsets.some((a) => a.entityId === f.entityId)
    )
    return {
      type: "adset" as const,
      name: f.name,
      campaignName: group?.campaign.name,
    }
  })
}

export function formatCop(amount: number): string {
  return formatCurrency(amount, META_DASHBOARD_CURRENCY)
}
