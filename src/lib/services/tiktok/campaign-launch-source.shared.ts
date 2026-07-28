/** Canal de lanzamiento de una campaña TikTok. */
export const TIKTOK_CAMPAIGN_LAUNCH_SOURCES = ["dashboard", "manual"] as const

export type TikTokCampaignLaunchSourceValue =
  (typeof TIKTOK_CAMPAIGN_LAUNCH_SOURCES)[number]

export type TikTokCampaignLaunchSourceRow = {
  campaignId: string
  source: TikTokCampaignLaunchSourceValue
  /** ISO date — cuándo se marcó el canal (fecha del badge). */
  markedAt: string
}

export const TIKTOK_CAMPAIGN_LAUNCH_SOURCE_LABELS: Record<
  TikTokCampaignLaunchSourceValue,
  string
> = {
  dashboard: "Dashboard",
  manual: "Manual",
}
