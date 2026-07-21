import { formatCurrency } from "@/lib/format"
import type { CampaignAdSetRow, CampaignRow } from "@/lib/services/meta/types"
import { isTikTokEditableDailyBudget } from "@/lib/services/tiktok/budget-mode"
import type { TikTokAgentPlannedAction, TikTokAgentThresholds } from "./types"

function isActive(status: CampaignRow["status"] | CampaignAdSetRow["status"]): boolean {
  return status === "ACTIVE"
}

function roundPen(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Elige el conjunto activo con mejor resultado del día (más compras, luego mejor CPA)
 * y planifica subir su presupuesto diario según el % configurado.
 */
export function planScaleBestAdGroup(input: {
  campaigns: CampaignRow[]
  adsetsByCampaign: Record<string, CampaignAdSetRow[]>
  thresholds: TikTokAgentThresholds
  /** IDs de conjuntos/campañas que se van a pausar en esta corrida (excluir). */
  excludeEntityIds?: Set<string>
}): TikTokAgentPlannedAction | null {
  if (!input.thresholds.scaleBestEnabled) return null

  const percent = input.thresholds.scaleBestBudgetIncreasePercent
  if (!Number.isFinite(percent) || percent < 1) return null

  const campaignById = new Map(
    input.campaigns.map((campaign) => [campaign.id, campaign])
  )
  const exclude = input.excludeEntityIds ?? new Set<string>()

  type Candidate = {
    adset: CampaignAdSetRow
    campaign: CampaignRow
    purchases: number
    cpaPen: number
    spendPen: number
    budget: number
  }

  const candidates: Candidate[] = []

  for (const [campaignId, adsets] of Object.entries(input.adsetsByCampaign)) {
    if (exclude.has(campaignId)) continue
    const campaign = campaignById.get(campaignId)
    if (!campaign || !isActive(campaign.status)) continue

    for (const adset of adsets) {
      if (!isActive(adset.status)) continue
      if (exclude.has(adset.id)) continue

      const purchases = adset.results ?? 0
      if (purchases <= 0) continue

      if (!isTikTokEditableDailyBudget(adset.budgetMode)) continue
      const budget = adset.dailyBudget
      if (budget == null || !Number.isFinite(budget) || budget < 1) continue

      const spendPen = adset.spend
      const cpaPen =
        purchases > 0 && spendPen > 0
          ? adset.costPerResult || spendPen / purchases
          : Number.POSITIVE_INFINITY

      candidates.push({
        adset,
        campaign,
        purchases,
        cpaPen,
        spendPen,
        budget,
      })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (b.purchases !== a.purchases) return b.purchases - a.purchases
    if (a.cpaPen !== b.cpaPen) return a.cpaPen - b.cpaPen
    return b.spendPen - a.spendPen
  })

  const best = candidates[0]!
  const budgetAfter = roundPen(best.budget * (1 + percent / 100))
  if (budgetAfter <= best.budget) return null

  const cpaLabel =
    Number.isFinite(best.cpaPen) && best.cpaPen > 0
      ? formatCurrency(best.cpaPen, "PEN")
      : "—"

  return {
    kind: "scale_adgroup",
    entityId: best.adset.id,
    entityName: best.adset.name,
    campaignId: best.campaign.id,
    campaignName: best.campaign.name,
    spendPen: best.spendPen,
    purchases: best.purchases,
    cpaPen: Number.isFinite(best.cpaPen) ? best.cpaPen : 0,
    budgetBeforePen: best.budget,
    budgetAfterPen: budgetAfter,
    budgetIncreasePercent: percent,
    reason: `Mejor resultado hoy: ${best.purchases} compra(s), CPA ${cpaLabel} → +${percent}% presupuesto`,
    applied: false,
  }
}
