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
import { getMetaAccountDailyInsights } from "./meta-account-daily-insights"
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

function isCampaignActive(campaign: MetaCampaign): boolean {
  return isMetaCampaignActiveForCount(campaign)
}

function isAdsetActive(adset: MetaAdSet): boolean {
  return isMetaAdSetActiveForCount({
    status: adset.status,
    effective_status: adset.effective_status,
  })
}

export async function syncMetaTrackCatalog(): Promise<void> {
  const api = getMetaClient()
  const [campaigns, adsetsRaw] = await Promise.all([
    getCachedMetaCampaignCatalog(api),
    getCachedMetaAdsetsCatalog(api),
  ])

  for (const campaign of campaigns) {
    const metaId = normalizeMetaId(campaign.id)
    if (!metaId) continue
    const status = (campaign.effective_status || campaign.status || "").toUpperCase()
    if (status === "DELETED") continue

    await prisma.metaTrackEntity.upsert({
      where: { metaId_type: { metaId, type: "campaign" } },
      create: {
        metaId,
        type: "campaign",
        name: campaign.name || `Campaña ${metaId}`,
        campaignMetaId: null,
        objective: "",
      },
      update: {
        name: campaign.name || `Campaña ${metaId}`,
      },
    })
  }

  for (const raw of adsetsRaw) {
    const adset = normalizeAdSetFromApi(raw as MetaAdSet & { campaign_id?: string | { id?: string } })
    const metaId = adset?.id
    if (!metaId) continue

    await prisma.metaTrackEntity.upsert({
      where: { metaId_type: { metaId, type: "adset" } },
      create: {
        metaId,
        type: "adset",
        name: adset.name || `Conjunto ${metaId}`,
        campaignMetaId: adset.campaign_id,
        objective: "",
      },
      update: {
        name: adset.name || `Conjunto ${metaId}`,
        campaignMetaId: adset.campaign_id,
      },
    })
  }
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

export async function syncMetaOperativeStateForDate(date: string): Promise<void> {
  if (date < getMetaInformeStartDate()) return

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
    const adset = normalizeAdSetFromApi(raw as MetaAdSet & { campaign_id?: string | { id?: string } })
    if (adset?.id) adsetById.set(adset.id, adset)
  }

  const entities = await prisma.metaTrackEntity.findMany()
  const range = date === getDashboardToday() ? getTodayDateRange() : { from: date, to: date }
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

type MetaDailyMetricCell = InformeEntityRow["dayCells"][number]

export async function getMetaInformePayload(): Promise<MetaInformePayload> {
  await syncMetaTrackCatalog()
  await pruneOperativeDaysBeforeInformeStart()

  const today = getDashboardToday()
  const informeStartDate = getMetaInformeStartDate()
  const dateRange = getMetaInformeDateRange()
  const dateKeys = getMetaInformeDateKeys()

  await syncMetaOperativeStateForDate(today)

  const [entities, operativeRows, daily, accountKpis] = await Promise.all([
    prisma.metaTrackEntity.findMany({ orderBy: { name: "asc" } }),
    prisma.metaOperativeDay.findMany({
      where: { date: { gte: dateRange.from, lte: dateRange.to } },
    }),
    getMetaAccountDailyInsights(dateRange),
    getAccountKpis(getTodayDateRange()),
  ])

  const operativeByEntityDate = new Map<string, (typeof operativeRows)[0]>()
  for (const row of operativeRows) {
    operativeByEntityDate.set(`${row.entityId}:${row.date}`, row)
  }

  const campaignDaily = new Map(daily.campaigns.map((c) => [c.metaId, c.days]))
  const adsetDaily = new Map(daily.adsets.map((a) => [a.metaId, a.days]))

  const campaignEntities = entities.filter((e) => e.type === "campaign")
  const adsetEntities = entities.filter((e) => e.type === "adset")

  const groups: InformeCampaignGroup[] = []
  const allRows: InformeEntityRow[] = []

  for (const campaign of campaignEntities) {
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

    const adsets = adsetEntities
      .filter((a) => a.campaignMetaId === campaign.metaId)
      .map((adset) => {
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
  await syncMetaTrackCatalog()
  await syncMetaOperativeStateForDate(date)

  const entities = await prisma.metaTrackEntity.findMany()
  const operative = await prisma.metaOperativeDay.findMany({ where: { date } })
  const opByEntity = new Map(operative.map((o) => [o.entityId, o]))
  const nameById = new Map(entities.map((e) => [e.id, e]))

  const forgotten: ForgottenActivationItem[] = []

  for (const entity of entities) {
    const day = opByEntity.get(entity.id)
    if (!day?.intentActive || day.metaWasActive) continue

    if (entity.type === "campaign") {
      forgotten.push({ type: "campaign", name: entity.name })
    } else {
      const campaign = entities.find(
        (c) => c.type === "campaign" && c.metaId === entity.campaignMetaId
      )
      forgotten.push({
        type: "adset",
        name: entity.name,
        campaignName: campaign?.name,
      })
    }
  }

  return forgotten
}

export function formatCop(amount: number): string {
  return formatCurrency(amount, META_DASHBOARD_CURRENCY)
}
