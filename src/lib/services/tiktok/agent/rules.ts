import { formatCurrency } from "@/lib/format"
import type { CampaignAdSetRow, CampaignRow } from "@/lib/services/meta/types"
import type { TikTokAgentPlannedAction, TikTokAgentThresholds } from "./types"

function isActive(status: CampaignRow["status"] | CampaignAdSetRow["status"]): boolean {
  return status === "ACTIVE"
}

function formatPenThreshold(value: number): string {
  return formatCurrency(value, "PEN")
}

export function planTikTokAgentActions(input: {
  campaigns: CampaignRow[]
  adsetsByCampaign: Record<string, CampaignAdSetRow[]>
  thresholds: TikTokAgentThresholds
}): TikTokAgentPlannedAction[] {
  const { campaigns, adsetsByCampaign, thresholds } = input
  const planned: TikTokAgentPlannedAction[] = []
  const campaignIdsToPause = new Set<string>()

  for (const campaign of campaigns) {
    if (!isActive(campaign.status)) continue
    const spendPen = campaign.spend
    const purchases = campaign.results ?? 0
    if (
      purchases === 0 &&
      spendPen >= thresholds.campaignPauseSpendPen
    ) {
      campaignIdsToPause.add(campaign.id)
      planned.push({
        kind: "pause_campaign",
        entityId: campaign.id,
        entityName: campaign.name,
        spendPen,
        purchases,
        cpaPen: 0,
        reason: `Gasto hoy ≥ ${formatPenThreshold(thresholds.campaignPauseSpendPen)} sin compras`,
        applied: false,
      })
    }
  }

  for (const campaign of campaigns) {
    if (campaignIdsToPause.has(campaign.id)) continue
    const adsets = adsetsByCampaign[campaign.id] ?? []
    for (const adset of adsets) {
      if (!isActive(adset.status)) continue
      const spendPen = adset.spend
      const purchases = adset.results ?? 0
      const cpaPen =
        purchases > 0 && adset.spend > 0 ? adset.costPerResult : 0

      if (
        purchases === 0 &&
        spendPen >= thresholds.adsetPauseSpendPen
      ) {
        planned.push({
          kind: "pause_adgroup",
          entityId: adset.id,
          entityName: adset.name,
          campaignId: campaign.id,
          campaignName: campaign.name,
          spendPen,
          purchases,
          cpaPen,
          reason: `Conjunto: gasto hoy ≥ ${formatPenThreshold(thresholds.adsetPauseSpendPen)} sin compras`,
          applied: false,
        })
        continue
      }

      if (
        purchases > 0 &&
        cpaPen >= thresholds.adsetCpaCriticoPen
      ) {
        planned.push({
          kind: "pause_adgroup",
          entityId: adset.id,
          entityName: adset.name,
          campaignId: campaign.id,
          campaignName: campaign.name,
          spendPen,
          purchases,
          cpaPen,
          reason: `CPA hoy ≥ ${formatPenThreshold(thresholds.adsetCpaCriticoPen)} (${purchases} compra(s))`,
          applied: false,
        })
      }
    }
  }

  return planned.sort((a, b) => b.spendPen - a.spendPen)
}
