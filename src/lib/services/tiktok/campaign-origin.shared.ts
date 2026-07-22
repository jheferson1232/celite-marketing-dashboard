export const TIKTOK_CAMPAIGN_ORIGINS = ["ia", "reutilizado"] as const

export type TikTokCampaignOriginValue =
  (typeof TIKTOK_CAMPAIGN_ORIGINS)[number]

export type TikTokCampaignOriginRow = {
  campaignId: string
  origin: TikTokCampaignOriginValue
}

export const TIKTOK_CAMPAIGN_ORIGIN_LABELS: Record<
  TikTokCampaignOriginValue,
  string
> = {
  ia: "IA",
  reutilizado: "Reutilizado",
}
