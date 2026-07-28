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
import { backfillDashboardLaunchSourcesFromTikTokCampaigns } from "@/lib/services/tiktok/campaign-launch-source"
import { withTikTokDashboardAccount } from "@/lib/services/tiktok/tiktok-dashboard-account.server"
import type { TikTokCampaignKanbanOutcomeRow } from "./campaign-kanban-outcome.shared"

export type CampaignOutcomeMetrics = {
  totalSpend: number
  totalPurchases: number
  totalCpa: number
}

export type CampaignKanbanRecord = CampaignRecord & {
  metrics: CampaignOutcomeMetrics | null
  /** Canal de lanzamiento: las del kanban son del dashboard. */
  launchSource: "dashboard"
}

function normalizeCampaignName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

type TikTokCampaignRow = { campaign_id: string; campaign_name: string }

async function loadTikTokCampaignsAndMetrics(): Promise<{
  metricsByName: Map<string, CampaignOutcomeMetrics>
  campaigns: TikTokCampaignRow[]
}> {
  const lifetimeRange = getTikTokLifetimeDateRange()
  const metricsById = await fetchCachedCampaignMetricsByDateRange(lifetimeRange)

  const { fetchAllPages } = await import("@/lib/services/tiktok/fetch-all-pages")
  const campaigns = await fetchAllPages<TikTokCampaignRow>("campaign/get/")

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
  return { metricsByName: byName, campaigns }
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
    let tiktokCampaigns: TikTokCampaignRow[] = []
    try {
      const loaded = await loadTikTokCampaignsAndMetrics()
      metricsByName = loaded.metricsByName
      tiktokCampaigns = loaded.campaigns
    } catch (error) {
      console.error(
        "[campaigns-kanban] No se pudieron cargar métricas TikTok:",
        error
      )
    }

    if (tiktokCampaigns.length > 0) {
      await backfillDashboardLaunchSourcesFromTikTokCampaigns(tiktokCampaigns)
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

      enriched.push({
        ...campaign,
        status,
        metrics,
        launchSource: "dashboard",
      })
    }

    return enriched
  })
}

export type { TikTokCampaignKanbanOutcomeRow } from "./campaign-kanban-outcome.shared"

/**
 * Mapa TikTok campaign_id → ganador/perdedor según el kanban de /campaigns
 * (match por nombre + misma clasificación lifetime).
 */
export async function listTikTokCampaignKanbanOutcomes(
  accountId?: string
): Promise<TikTokCampaignKanbanOutcomeRow[]> {
  return withTikTokDashboardAccount(accountId, async () => {
    const kanban = await listCampaignsForKanban(accountId)

    const outcomeByName = new Map<string, "winner" | "loser">()
    for (const campaign of kanban) {
      if (campaign.status === "winner" || campaign.status === "loser") {
        outcomeByName.set(normalizeCampaignName(campaign.name), campaign.status)
      }
    }

    if (outcomeByName.size === 0) return []

    let tiktokCampaigns: TikTokCampaignRow[] = []
    try {
      const loaded = await loadTikTokCampaignsAndMetrics()
      tiktokCampaigns = loaded.campaigns
    } catch (error) {
      console.error(
        "[campaigns-kanban] No se pudieron cargar campañas TikTok para outcomes:",
        error
      )
      return []
    }

    const rows: TikTokCampaignKanbanOutcomeRow[] = []
    for (const campaign of tiktokCampaigns) {
      const outcome = outcomeByName.get(
        normalizeCampaignName(campaign.campaign_name || "")
      )
      if (outcome) {
        rows.push({ campaignId: campaign.campaign_id, outcome })
      }
    }

    return rows
  })
}
