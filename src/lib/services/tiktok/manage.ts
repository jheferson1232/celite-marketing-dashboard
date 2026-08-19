import { isTikTokEditableDailyBudget } from "./budget-mode"
import { fetchAllPages } from "./fetch-all-pages"
import { getTikTokRequestContext } from "./tiktok-api.server"
import { clearTikTokCache } from "./tiktok-cache"
import type { TikTokAdGroup, TikTokCampaign } from "./types"

export type TikTokOperationStatus = "ENABLE" | "DISABLE"

const DEFAULT_MAX_DAILY_BUDGET_PEN = 10_000

function getMaxDailyBudgetPen(): number {
  const fromEnv = process.env.TIKTOK_MAX_DAILY_BUDGET_PEN
  if (!fromEnv) return DEFAULT_MAX_DAILY_BUDGET_PEN
  const parsed = Number(fromEnv)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_DAILY_BUDGET_PEN
}

function assertValidDailyBudget(budget: number) {
  if (!Number.isFinite(budget) || budget < 1) {
    throw new Error("El presupuesto diario debe ser al menos S/ 1")
  }

  const max = getMaxDailyBudgetPen()
  if (budget > max) {
    throw new Error(
      `El presupuesto diario no puede superar S/ ${max.toLocaleString("es-PE")}`
    )
  }
}

function invalidateTikTokDataCache() {
  clearTikTokCache()
}

const ADGROUP_STATUS_BATCH_SIZE = 20

async function fetchAdGroupsForCampaign(
  campaignId: string
): Promise<TikTokAdGroup[]> {
  return fetchAllPages<TikTokAdGroup>("/adgroup/get/", {
    filtering: JSON.stringify({ campaign_ids: [campaignId] }),
  })
}

async function fetchCampaignById(
  campaignId: string
): Promise<TikTokCampaign | null> {
  const campaigns = await fetchAllPages<TikTokCampaign>("/campaign/get/", {
    filtering: JSON.stringify({ campaign_ids: [campaignId] }),
  })
  return campaigns.find((c) => c.campaign_id === campaignId) ?? null
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function isUpgradedSmartPlusAdGroup(adGroup: TikTokAdGroup): boolean {
  return adGroup.campaign_automation_type === "UPGRADED_SMART_PLUS"
}

async function fetchAdGroupById(adgroupId: string): Promise<TikTokAdGroup | null> {
  const groups = await fetchAllPages<TikTokAdGroup>("/adgroup/get/", {
    filtering: JSON.stringify({ adgroup_ids: [adgroupId] }),
    fields: JSON.stringify([
      "adgroup_id",
      "campaign_id",
      "campaign_automation_type",
    ]),
  })
  return groups.find((g) => g.adgroup_id === adgroupId) ?? null
}

export interface TikTokCampaignActivationState {
  campaignId: string
  campaignOperationStatus: TikTokOperationStatus
  adGroupsTotal: number
  adGroupsEnabled: number
  isFullyActive: boolean
}

export async function getTikTokCampaignActivationState(
  campaignId: string
): Promise<TikTokCampaignActivationState> {
  const [campaign, adGroups] = await Promise.all([
    fetchCampaignById(campaignId),
    fetchAdGroupsForCampaign(campaignId),
  ])

  const campaignOperationStatus: TikTokOperationStatus =
    campaign?.operation_status === "ENABLE" ? "ENABLE" : "DISABLE"
  const adGroupsEnabled = adGroups.filter(
    (g) => g.operation_status === "ENABLE"
  ).length

  return {
    campaignId,
    campaignOperationStatus,
    adGroupsTotal: adGroups.length,
    adGroupsEnabled,
    isFullyActive:
      campaignOperationStatus === "ENABLE" &&
      adGroups.length > 0 &&
      adGroupsEnabled === adGroups.length,
  }
}

/** Activa o pausa solo la campaña (no modifica conjuntos). */
export async function setTikTokCampaignStatusOnly(
  campaignId: string,
  operationStatus: TikTokOperationStatus
): Promise<TikTokCampaignActivationState> {
  await updateTikTokCampaignStatus([campaignId], operationStatus)
  return getTikTokCampaignActivationState(campaignId)
}

/** Activa campaña y todos sus conjuntos. */
export async function activateTikTokCampaignComplete(
  campaignId: string
): Promise<TikTokCampaignActivationState> {
  await updateTikTokCampaignStatus([campaignId], "ENABLE")

  const adGroups = await fetchAdGroupsForCampaign(campaignId)
  const toEnable = adGroups
    .filter((g) => g.operation_status !== "ENABLE")
    .map((g) => g.adgroup_id)

  for (const batch of chunkArray(toEnable, ADGROUP_STATUS_BATCH_SIZE)) {
    if (batch.length > 0) {
      await updateTikTokAdGroupStatus(batch, "ENABLE")
    }
  }

  return getTikTokCampaignActivationState(campaignId)
}

/** Pausa campaña y todos sus conjuntos. */
export async function pauseTikTokCampaignComplete(
  campaignId: string
): Promise<TikTokCampaignActivationState> {
  const adGroups = await fetchAdGroupsForCampaign(campaignId)
  const adGroupIds = adGroups.map((g) => g.adgroup_id)

  for (const batch of chunkArray(adGroupIds, ADGROUP_STATUS_BATCH_SIZE)) {
    if (batch.length > 0) {
      await updateTikTokAdGroupStatus(batch, "DISABLE")
    }
  }

  await updateTikTokCampaignStatus([campaignId], "DISABLE")

  return getTikTokCampaignActivationState(campaignId)
}

export async function updateTikTokCampaignStatus(
  campaignIds: string[],
  operationStatus: TikTokOperationStatus
): Promise<void> {
  if (!campaignIds.length) {
    throw new Error("Se requiere al menos un ID de campaña")
  }

  const { client, advertiserId } = await getTikTokRequestContext()
  await client.post("/campaign/status/update/", {
    advertiser_id: advertiserId,
    campaign_ids: campaignIds,
    operation_status: operationStatus,
  })

  invalidateTikTokDataCache()
}

export async function updateTikTokAdGroupStatus(
  adgroupIds: string[],
  operationStatus: TikTokOperationStatus
): Promise<void> {
  if (!adgroupIds.length) {
    throw new Error("Se requiere al menos un ID de conjunto")
  }

  const { client, advertiserId } = await getTikTokRequestContext()
  const sample = await fetchAdGroupById(adgroupIds[0]!)
  const useSmartPlus = sample != null && isUpgradedSmartPlusAdGroup(sample)

  if (useSmartPlus) {
    await client.post("/smart_plus/adgroup/status/update/", {
      advertiser_id: advertiserId,
      adgroup_ids: adgroupIds,
      operation_status: operationStatus,
    })
  } else {
    await client.post("/adgroup/status/update/", {
      advertiser_id: advertiserId,
      adgroup_ids: adgroupIds,
      operation_status: operationStatus,
    })
  }

  invalidateTikTokDataCache()
}

export async function updateTikTokCampaignBudget(
  campaignId: string,
  budget: number
): Promise<void> {
  if (!campaignId) {
    throw new Error("Se requiere el ID de la campaña")
  }

  assertValidDailyBudget(budget)

  const { client, advertiserId } = await getTikTokRequestContext()
  await client.post("/campaign/update/", {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    budget,
  })

  invalidateTikTokDataCache()
}

export async function getTikTokAdGroupDailyBudget(
  adgroupId: string
): Promise<number | null> {
  const groups = await fetchAllPages<TikTokAdGroup>("/adgroup/get/", {
    filtering: JSON.stringify({ adgroup_ids: [adgroupId] }),
  })
  const group = groups.find((g) => g.adgroup_id === adgroupId)
  if (!group || !isTikTokEditableDailyBudget(group.budget_mode)) return null
  return group.budget ?? null
}

export async function getTikTokCampaignDailyBudget(
  campaignId: string
): Promise<number | null> {
  const campaigns = await fetchAllPages<TikTokCampaign>("/campaign/get/", {
    filtering: JSON.stringify({ campaign_ids: [campaignId] }),
  })
  const campaign = campaigns.find((c) => c.campaign_id === campaignId)
  if (!campaign || !isTikTokEditableDailyBudget(campaign.budget_mode)) return null
  return campaign.budget ?? null
}

export async function updateTikTokAdGroupBudget(
  adgroupId: string,
  budget: number
): Promise<void> {
  if (!adgroupId) {
    throw new Error("Se requiere el ID del conjunto")
  }

  assertValidDailyBudget(budget)

  const { client, advertiserId } = await getTikTokRequestContext()
  const adGroup = await fetchAdGroupById(adgroupId)
  const useSmartPlus = adGroup != null && isUpgradedSmartPlusAdGroup(adGroup)

  if (useSmartPlus) {
    await client.post("/smart_plus/adgroup/update/", {
      advertiser_id: advertiserId,
      adgroup_id: adgroupId,
      budget,
    })
  } else {
    await client.post("/adgroup/update/", {
      advertiser_id: advertiserId,
      adgroup_id: adgroupId,
      budget,
    })
  }

  invalidateTikTokDataCache()
}
