import type { CampaignAdSetRow, CampaignRow } from "@/lib/services/meta/types"

export function formatTikTokCampaignForAssistant(campaign: CampaignRow) {
  return {
    campaignId: campaign.id,
    name: campaign.name,
    status: campaign.status,
    operationStatus: campaign.operationStatus ?? null,
    dailyBudgetPen: campaign.dailyBudget ?? null,
    budgetMode: campaign.budgetMode ?? null,
    spendPen: campaign.spend,
    results: campaign.results,
  }
}

export function formatTikTokAdGroupForAssistant(adGroup: CampaignAdSetRow) {
  return {
    adgroupId: adGroup.id,
    name: adGroup.name,
    campaignId: adGroup.campaignId,
    status: adGroup.status,
    dailyBudgetPen: adGroup.dailyBudget ?? null,
    budgetMode: adGroup.budgetMode ?? null,
    spendPen: adGroup.spend,
    results: adGroup.results,
  }
}

export function findTikTokCampaignsByName(
  campaigns: CampaignRow[],
  query: string
): ReturnType<typeof formatTikTokCampaignForAssistant>[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return campaigns.map(formatTikTokCampaignForAssistant)

  return campaigns
    .filter((c) => c.name.toLowerCase().includes(normalized))
    .map(formatTikTokCampaignForAssistant)
}

export function findTikTokAdGroupsByName(
  adGroups: CampaignAdSetRow[],
  query: string
): ReturnType<typeof formatTikTokAdGroupForAssistant>[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return adGroups.map(formatTikTokAdGroupForAssistant)

  return adGroups
    .filter((g) => g.name.toLowerCase().includes(normalized))
    .map(formatTikTokAdGroupForAssistant)
}
