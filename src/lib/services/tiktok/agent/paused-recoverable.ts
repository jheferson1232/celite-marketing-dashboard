import prisma from "@/lib/prisma"
import { getTodayDateRange } from "@/lib/date"
import type { CampaignAdSetRow, CampaignRow } from "@/lib/services/meta/types"
import { getTikTokCampaignsList } from "@/lib/services/tiktok/campaigns-list"
import { getTikTokAdSetsGroupedByCampaign } from "@/lib/services/tiktok/campaign-adgroups"
import { getArchivedRecoverableCampaignIds } from "./archived-recoverable"
import { getTikTokAgentThresholds } from "./config"
import type { TikTokAgentPlannedAction } from "./types"

/** No listar campañas/conjuntos con CPA total por encima de este umbral (PEN). */
const MAX_TOTAL_CPA_PEN = 50

export type TikTokPausedRecoverableResult = {
  /**
   * Campañas apagadas con historial, o campañas (aunque estén ON) que tienen
   * conjuntos apagados con historial — para anidar al expandir.
   */
  campaigns: CampaignRow[]
  /** Solo conjuntos apagados (con historial). */
  adSetsByCampaignId: Record<string, CampaignAdSetRow[]>
  criticoCpaPen: number
  maxTotalCpaPen: number
}

function parseActions(json: unknown): TikTokAgentPlannedAction[] {
  if (!Array.isArray(json)) return []
  return json as TikTokAgentPlannedAction[]
}

function hasAcceptableTotalCpa(totalCpa: number | undefined): boolean {
  const cpa = totalCpa ?? 0
  return cpa > 0 && cpa <= MAX_TOTAL_CPA_PEN
}

/** Si hay corrida del agente, usa gasto/compras/CPA de ese día en columnas del periodo. */
function withPauseDayMetrics<
  T extends { spend: number; results: number; costPerResult: number },
>(
  row: T,
  pause: { spendPen: number; purchases: number; cpaPen: number } | undefined
): T {
  if (!pause) return row
  const spend = pause.spendPen
  const results = pause.purchases
  const costPerResult =
    pause.cpaPen > 0
      ? pause.cpaPen
      : results > 0 && spend > 0
        ? spend / results
        : 0
  return { ...row, spend, results, costPerResult }
}

function sortByTotalPurchasesThenCpa<
  T extends { totalPurchases?: number; totalCpa?: number },
>(a: T, b: T, criticoCpaPen: number): number {
  const aCpa = a.totalCpa ?? Number.POSITIVE_INFINITY
  const bCpa = b.totalCpa ?? Number.POSITIVE_INFINITY
  const aGood = (a.totalPurchases ?? 0) > 0 && aCpa < criticoCpaPen
  const bGood = (b.totalPurchases ?? 0) > 0 && bCpa < criticoCpaPen
  if (aGood !== bGood) return aGood ? -1 : 1
  if ((b.totalPurchases ?? 0) !== (a.totalPurchases ?? 0)) {
    return (b.totalPurchases ?? 0) - (a.totalPurchases ?? 0)
  }
  return aCpa - bCpa
}

/**
 * Campañas con conjuntos apagados (o campañas apagadas) que tienen historial.
 * Excluye CPA total &gt; 50. Al expandir solo se listan conjuntos desactivados.
 */
export async function listTikTokPausedRecoverable(): Promise<TikTokPausedRecoverableResult> {
  const thresholds = await getTikTokAgentThresholds()
  const dateRange = getTodayDateRange()

  const [runs, campaigns, adsetsByCampaign, archivedIds] = await Promise.all([
    prisma.tikTokAgentRun.findMany({
      where: {
        status: "success",
        dryRun: false,
      },
      orderBy: { startedAt: "desc" },
      take: 100,
      select: {
        id: true,
        startedAt: true,
        actions: true,
      },
    }),
    getTikTokCampaignsList(dateRange),
    getTikTokAdSetsGroupedByCampaign(dateRange),
    getArchivedRecoverableCampaignIds(),
  ])

  const campaignById = new Map(campaigns.map((c) => [c.id, c]))

  const agentPauseMetaByEntity = new Map<
    string,
    { spendPen: number; purchases: number; cpaPen: number }
  >()

  for (const run of runs) {
    for (const action of parseActions(run.actions)) {
      if (!action.applied) continue
      if (
        action.kind !== "pause_adgroup" &&
        action.kind !== "pause_campaign"
      ) {
        continue
      }
      if (agentPauseMetaByEntity.has(action.entityId)) continue
      agentPauseMetaByEntity.set(action.entityId, {
        spendPen: action.spendPen,
        purchases: action.purchases,
        cpaPen: action.cpaPen,
      })
    }
  }

  const pausedCampaignIds = new Set<string>()
  for (const campaign of campaigns) {
    if (campaign.status !== "PAUSED") continue
    if ((campaign.totalPurchases ?? 0) <= 0) continue
    if (!hasAcceptableTotalCpa(campaign.totalCpa)) continue
    pausedCampaignIds.add(campaign.id)
  }

  const adSetsByCampaignId: Record<string, CampaignAdSetRow[]> = {}
  for (const adsets of Object.values(adsetsByCampaign)) {
    for (const adset of adsets) {
      if (adset.status !== "PAUSED") continue
      if ((adset.totalPurchases ?? 0) <= 0) continue
      if (!hasAcceptableTotalCpa(adset.totalCpa)) continue
      const list = adSetsByCampaignId[adset.campaignId] ?? []
      list.push(
        withPauseDayMetrics(adset, agentPauseMetaByEntity.get(adset.id))
      )
      adSetsByCampaignId[adset.campaignId] = list
    }
  }

  for (const campaignId of Object.keys(adSetsByCampaignId)) {
    adSetsByCampaignId[campaignId].sort((a, b) =>
      sortByTotalPurchasesThenCpa(a, b, thresholds.adsetCpaCriticoPen)
    )
  }

  const campaignIdsToShow = new Set<string>([
    ...pausedCampaignIds,
    ...Object.keys(adSetsByCampaignId),
  ])

  const resultCampaigns: CampaignRow[] = []
  for (const campaignId of campaignIdsToShow) {
    if (archivedIds.has(campaignId)) continue
    const campaign = campaignById.get(campaignId)
    if (!campaign) continue
    // No listar campañas con CPA total > 50 (tampoco como contenedor).
    if (!hasAcceptableTotalCpa(campaign.totalCpa)) continue
    if (!adSetsByCampaignId[campaignId]) {
      adSetsByCampaignId[campaignId] = []
    }
    if (pausedCampaignIds.has(campaignId)) {
      resultCampaigns.push(
        withPauseDayMetrics(campaign, agentPauseMetaByEntity.get(campaignId))
      )
    } else {
      // Campaña ON: contenedor de conjuntos apagados con CPA ≤ 50.
      resultCampaigns.push(campaign)
    }
  }

  // Quitar conjuntos de campañas archivadas o filtradas por CPA alto.
  for (const campaignId of Object.keys(adSetsByCampaignId)) {
    if (!resultCampaigns.some((c) => c.id === campaignId)) {
      delete adSetsByCampaignId[campaignId]
    }
  }

  resultCampaigns.sort((a, b) =>
    sortByTotalPurchasesThenCpa(a, b, thresholds.adsetCpaCriticoPen)
  )

  return {
    campaigns: resultCampaigns,
    adSetsByCampaignId,
    criticoCpaPen: thresholds.adsetCpaCriticoPen,
    maxTotalCpaPen: MAX_TOTAL_CPA_PEN,
  }
}
