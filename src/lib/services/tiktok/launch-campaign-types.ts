export type TikTokLaunchCampaignConfig = {
  campaign: {
    name: string
    campaign_id?: string
    objective?: string
    daily_budget: number
    pixel_id: string
    optimization_event?: string
    location_ids?: string[]
    age_groups?: string[]
    gender?: string
    display_name?: string
    ad_text?: string
    default_url?: string
    identity_id?: string
    /** Código de autorización Spark Ads (video orgánico). */
    auth_code?: string
    utm?: Record<string, string>
    launch?: boolean
  }
  ctas?: string[]
  adgroups: Array<{
    name: string
    video?: string
    video_id?: string
    /** Post orgánico Spark: usa el mismo item + identidad (no resube video). */
    tiktok_item_id?: string
    identity_id?: string
    identity_type?: string
    url?: string
  }>
}

export type TikTokLaunchAdGroupResult = {
  name: string
  adgroup_id: string
  ad_id?: string
  cta: string
  url: string
}

export type TikTokLaunchResult = {
  campaignName: string
  campaignId: string
  adGroupCount: number
  active: boolean
  reusedExistingCampaign?: boolean
  adGroups: TikTokLaunchAdGroupResult[]
}
