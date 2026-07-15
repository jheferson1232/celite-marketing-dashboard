import "server-only"

import {
  classifyCampaignOutcome,
  type CampaignStatus,
} from "@/lib/campaigns/status"
import {
  listCampaigns,
  updateCampaignStatus,
  type CampaignRecord,
} from "@/lib/services/campaign"
import {
  fetchCachedCampaignMetricsByDateRange,
  getPurchaseSpendAndCpa,
  getTikTokLifetimeDateRange,
} from "@/lib/services/tiktok/report"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"

export type CampaignOutcomeMetrics = {
  totalSpend: number
  totalPurchases: number
  totalCpa: number
}

export type CampaignKanbanRecord = CampaignRecord & {
  metrics: CampaignOutcomeMetrics | null
}

function normalizeCampaignName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

async function loadTikTokLifetimeMetricsByName(): Promise<
  Map<string, CampaignOutcomeMetrics>
> {
  const lifetimeRange = getTikTokLifetimeDateRange()
  const metricsById = await fetchCachedCampaignMetricsByDateRange(lifetimeRange)

  // Necesitamos nombres: reutilizar campaign/get liviano
  const { fetchAllPages } = await import("@/lib/services/tiktok/fetch-all-pages")
  type TikTokCampaign = { campaign_id: string; campaign_name: string }
  const campaigns = await fetchAllPages<TikTokCampaign>("campaign/get/")

  const byName = new Map<string, CampaignOutcomeMetrics>()
  for (const campaign of campaigns) {
    const key = normalizeCampaignName(campaign.campaign_name || "")
    if (!key) continue
    const raw = metricsById.get(campaign.campaign_id) ?? {}
    const { spend, purchases, cpa } = getPurchaseSpendAndCpa(raw)
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, {
        totalSpend: spend,
        totalPurchases: purchases,
        totalCpa: cpa,
      })
      continue
    }
    // Si hay nombres duplicados, sumar
    const totalSpend = existing.totalSpend + spend
    const totalPurchases = existing.totalPurchases + purchases
    byName.set(key, {
      totalSpend,
      totalPurchases,
      totalCpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
    })
  }
  return byName
}

/**
 * Lista campañas del kanban enriquecidas con gasto/CPA lifetime de TikTok
 * (match por nombre). Auto-mueve «running» → winner/loser si gasto ≥ 100 S/.
 */
export async function listCampaignsForKanban(
  accountId?: string
): Promise<CampaignKanbanRecord[]> {
  return withTikTokDashboardAccount(accountId, async () => {
    const campaigns = await listCampaigns()

    let metricsByName = new Map<string, CampaignOutcomeMetrics>()
    try {
      metricsByName = await loadTikTokLifetimeMetricsByName()
    } catch (error) {
      console.error(
        "[campaigns-kanban] No se pudieron cargar métricas TikTok:",
        error
      )
    }

    const enriched: CampaignKanbanRecord[] = []

    for (const campaign of campaigns) {
      const metrics =
        metricsByName.get(normalizeCampaignName(campaign.name)) ?? null

      let status: CampaignStatus = campaign.status
      if (campaign.status === "running" && metrics) {
        const outcome = classifyCampaignOutcome({
          totalSpend: metrics.totalSpend,
          totalPurchases: metrics.totalPurchases,
          totalCpa: metrics.totalCpa,
        })
        if (outcome) {
          // Aplicar en la respuesta aunque falle el persist (p. ej. cliente Prisma viejo).
          status = outcome
          try {
            await updateCampaignStatus(campaign.id, outcome)
          } catch (error) {
            console.error(
              `[campaigns-kanban] No se pudo auto-clasificar ${campaign.id}:`,
              error
            )
          }
        }
      }

      enriched.push({ ...campaign, status, metrics })
    }

    return enriched
  })
}
