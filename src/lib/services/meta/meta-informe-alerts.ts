import {
  INFORME_ADSET_APAGAR_SPEND_COP,
  INFORME_CAMPAIGN_APAGAR_SPEND_COP,
  informeEstadoFilterForEntity,
} from "./meta-informe-scoring"

/** Evita dependencia circular con meta-operative-service. */
export type InformeCampaignGroupForAlerts = {
  campaign: {
    name: string
    spendToday: number
    purchasesToday: number
    metaWasActive: boolean
    pointsTotal: number
  }
  adsets: {
    name: string
    spendToday: number
    purchasesToday: number
    cpaToday: number
    metaWasActive: boolean
  }[]
}

export type InformeCriticoActivoItem = {
  type: "adset"
  name: string
  campaignName: string
  spend: number
  purchases: number
  cpa: number
}

export type InformePauseItem = {
  type: "campaign" | "adset"
  name: string
  campaignName?: string
  spend: number
  purchases: number
}

export type InformeCampaignSummary = {
  name: string
  metaWasActive: boolean
  spend: number
  purchases: number
  pointsTotal: number
  adsetCount: number
}

/** Conjunto ON en estado Crítico hoy (CPA alto o gasto sin compras). */
export function collectAdsetsCriticoActivos(
  groups: InformeCampaignGroupForAlerts[]
): InformeCriticoActivoItem[] {
  const items: InformeCriticoActivoItem[] = []
  for (const group of groups) {
    for (const adset of group.adsets) {
      if (!adset.metaWasActive) continue
      const estado = informeEstadoFilterForEntity({
        type: "adset",
        spendToday: adset.spendToday,
        purchasesToday: adset.purchasesToday,
        cpaToday: adset.cpaToday,
      })
      if (estado !== "CRITICO") continue
      items.push({
        type: "adset",
        name: adset.name,
        campaignName: group.campaign.name,
        spend: adset.spendToday,
        purchases: adset.purchasesToday,
        cpa: adset.cpaToday,
      })
    }
  }
  return items.sort((a, b) => b.spend - a.spend)
}

export function collectAdsetsToPause(
  groups: InformeCampaignGroupForAlerts[]
): InformePauseItem[] {
  const items: InformePauseItem[] = []
  for (const group of groups) {
    for (const adset of group.adsets) {
      const spend = adset.spendToday
      const purchases = adset.purchasesToday
      if (
        adset.metaWasActive &&
        spend >= INFORME_ADSET_APAGAR_SPEND_COP &&
        purchases === 0
      ) {
        items.push({
          type: "adset",
          name: adset.name,
          campaignName: group.campaign.name,
          spend,
          purchases,
        })
      }
    }
  }
  return items.sort((a, b) => b.spend - a.spend)
}

export function collectCampaignsToPause(
  groups: InformeCampaignGroupForAlerts[]
): InformePauseItem[] {
  const items: InformePauseItem[] = []
  for (const group of groups) {
    const spend = group.campaign.spendToday
    const purchases = group.campaign.purchasesToday
    if (
      group.campaign.metaWasActive &&
      spend >= INFORME_CAMPAIGN_APAGAR_SPEND_COP &&
      purchases === 0
    ) {
      items.push({
        type: "campaign",
        name: group.campaign.name,
        spend,
        purchases,
      })
    }
  }
  return items.sort((a, b) => b.spend - a.spend)
}

export function buildInformeCampaignSummaries(
  groups: InformeCampaignGroupForAlerts[]
): InformeCampaignSummary[] {
  return groups.map((group) => {
    const spend = group.campaign.spendToday
    const purchases = group.campaign.purchasesToday
    return {
      name: group.campaign.name,
      metaWasActive: group.campaign.metaWasActive,
      spend,
      purchases,
      pointsTotal: group.campaign.pointsTotal,
      adsetCount: group.adsets.length,
    }
  })
}
