export interface TikTokPageInfo {
  page: number
  page_size: number
  total_page: number
  total_number: number
}

export interface TikTokListResponse<T> {
  list: T[]
  page_info: TikTokPageInfo
}

export interface TikTokApiResponse<T> {
  code: number
  message: string
  data: T
  request_id?: string
}

export interface TikTokReportRow {
  dimensions: Record<string, string>
  metrics: Record<string, string>
}

export interface TikTokReportData {
  list: TikTokReportRow[]
  page_info: TikTokPageInfo
}

export interface TikTokCampaign {
  campaign_id: string
  campaign_name: string
  operation_status?: string
  objective_type?: string
  budget?: number
  budget_mode?: string
}

export interface TikTokAdGroup {
  adgroup_id: string
  adgroup_name: string
  campaign_id: string
  operation_status?: string
  budget?: number
  budget_mode?: string
  campaign_automation_type?: string
}

export interface TikTokAd {
  ad_id: string
  ad_name: string
  campaign_id?: string
  campaign_name?: string
  adgroup_id?: string
  operation_status?: string
  create_time?: string
  landing_page_url?: string
  landing_page_urls?: string[]
  campaign_automation_type?: string
  image_ids?: string[]
  video_id?: string
  ad_format?: string
  creative_authorized?: boolean
}

export interface TikTokAdImage {
  image_id: string
  image_url?: string
}

export interface TikTokAdVideo {
  video_id: string
  video_cover_url?: string
  poster_url?: string
}
