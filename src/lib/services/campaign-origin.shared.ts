/** Valores compartidos de origen creativo (Meta + TikTok). */
export const CAMPAIGN_ORIGINS = ["ia", "reutilizado"] as const

export type CampaignOriginValue = (typeof CAMPAIGN_ORIGINS)[number]

export type CampaignOriginRow = {
  campaignId: string
  origin: CampaignOriginValue
}

export const CAMPAIGN_ORIGIN_LABELS: Record<CampaignOriginValue, string> = {
  ia: "IA",
  reutilizado: "Reutilizado",
}

export type CampaignOriginPlatform = "tiktok" | "meta"
