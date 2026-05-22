export interface DateRange {
  from: string
  to: string
}

export interface MetaAction {
  action_type: string
  value: string
}

export interface MetaActionValue {
  action_type: string
  value: string
}

export interface MetaInsightRow {
  date_start?: string
  date_stop?: string
  campaign_name?: string
  campaign_id?: string
  adset_id?: string
  adset_name?: string
  objective?: string
  spend: string
  impressions: string
  clicks?: string
  ctr: string
  cpc?: string
  cpm?: string
  actions?: MetaAction[]
  cost_per_action_type?: MetaAction[]
  action_values?: MetaActionValue[]
  purchase_roas?: { type: string; value: string }[]
}

export interface MetaInsightsResponse {
  data: MetaInsightRow[]
  paging?: {
    cursors: {
      before: string
      after: string
    }
    next?: string
  }
}

export interface MetaAdSet {
  id?: string
  name?: string
  campaign_id: string
  status: string
  effective_status?: string
}

export interface MetaCampaign {
  id: string
  name?: string
  status?: string
  effective_status?: string
}

export type CampaignEntityStatus =
  | "ACTIVE"
  | "PAUSED"
  | "ARCHIVED"
  | "DELETED"
  | "UNKNOWN"

export interface CampaignAdSetRow {
  id: string
  name: string
  status: CampaignEntityStatus
  campaignId: string
  /** Estado operativo del conjunto (interruptor), no el de campaña. */
  adSetEffectiveStatus?: string
  spend: number
  impressions: number
  ctr: number
  cpc: number
  results: number
  costPerResult: number
  roas: number
  /** Agregados al carrito (Meta actions / TikTok web_event_add_to_cart). */
  addToCart?: number
  /** TikTok: compras en los últimos 7 días (calendario dashboard). */
  purchases7d?: number
  cpa7d?: number
  /** TikTok / Meta: compras acumuladas en ventana larga (~365 días). */
  totalPurchases?: number
  /** Gasto acumulado (~365 días). */
  totalSpend?: number
  totalCpa?: number
  /** Presupuesto diario en PEN (TikTok ad groups con BUDGET_MODE_DAY). */
  dailyBudget?: number | null
  budgetMode?: string | null
  /** UPGRADED_SMART_PLUS requiere endpoints smart_plus/ en la API. */
  campaignAutomationType?: string | null
}

export interface MetaAdSetResponse {
  data: MetaAdSet[]
  paging?: {
    next?: string
  }
}

export interface MetaAd {
  campaign_id: string
  effective_status: string
}

export interface MetaAdResponse {
  data: MetaAd[]
  paging?: {
    next?: string
  }
}

export interface AccountKpis {
  totalSpend: number
  impressions: number
  clicks: number
  ctr: number
  cpa: number
  cpm: number
  purchases: number
  roas: number
  /** Agregados al carrito (Meta actions / TikTok web_event_add_to_cart). */
  addToCart?: number
}

export interface CampaignRow {
  id: string
  name: string
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED" | "UNKNOWN"
  spend: number
  impressions: number
  adSetsCount: number
  activeAdsCount: number
  ctr: number
  cpc: number
  results: number
  costPerResult: number
  roas: number
  addToCart?: number
  objective: string
  /** Estado operativo en TikTok (ENABLE/DISABLE). */
  operationStatus?: "ENABLE" | "DISABLE"
  /** Presupuesto diario en PEN cuando aplica (campaña o CBO). */
  dailyBudget?: number | null
  budgetMode?: string | null
  /** Suma de presupuesto diario de conjuntos (TikTok ABO). */
  adGroupDailyBudgetSum?: number | null
  /** TikTok: compras en los últimos 7 días. */
  purchases7d?: number
  cpa7d?: number
  /** TikTok: compras acumuladas en ventana larga (~365 días). */
  totalPurchases?: number
  /** TikTok: gasto acumulado en ventana larga (~365 días). */
  totalSpend?: number
  /** TikTok: CPA sobre totales acumulados. */
  totalCpa?: number
  /** URLs de destino únicas configuradas en anuncios de la campaña. */
  landingUrls?: string[]
}

export interface MetaAdCreativeObjectStorySpec {
  photo_data?: {
    url?: string
    image_hash?: string
  }
  video_data?: {
    video_id?: string
    image_url?: string
  }
  link_data?: {
    picture?: string
    image_url?: string
  }
}

export interface MetaAdCreative {
  id: string
  name?: string
  thumbnail_url?: string
  image_url?: string
  image_hash?: string
  video_id?: string
  body?: string
  title?: string
  object_story_spec?: MetaAdCreativeObjectStorySpec
}

export interface MetaAdWithExpandedInsights {
  id: string
  creative?: MetaAdCreative
  insights?: {
    data: MetaAdInsightRow[]
  }
}

export interface MetaAdWithExpandedInsightsResponse {
  data: MetaAdWithExpandedInsights[]
  paging?: { next?: string }
}

export interface MetaAdInsightRow {
  ad_id?: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  frequency: string
  actions?: MetaAction[]
  cost_per_action_type?: MetaAction[]
}

export interface MetaAdInsightsResponse {
  data: MetaAdInsightRow[]
  paging?: {
    cursors: {
      before: string
      after: string
    }
    next?: string
  }
}

export interface AdInsightRow {
  ad_name: string
  ad_id: string
  adset_name?: string
  adset_id?: string
  campaign_name?: string
  campaign_id?: string
  spend: string
  impressions: string
  reach: string
  frequency: string
  clicks: string
  ctr: string
  cpc: string
  cpm: string
  actions?: MetaAction[]
  action_values?: MetaActionValue[]
  cost_per_action_type?: MetaAction[]
  purchase_roas?: { action_type: string; value: string }[]
  thumbnail_url: string
  image_url?: string
  video_url: string
  video_id: string
  effective_status: string
  url: string
  created_time?: string
  /** Compras desglosadas por género (insights con breakdowns=gender). */
  purchasesByGender?: {
    male: number
    female: number
    unknown: number
  }
}

export interface CreativeRow {
  id: string
  adId?: string
  name: string
  thumbnailUrl: string
  imageUrl?: string
  videoId?: string
  videoUrl?: string
  mediaType: "image" | "video"
  totalSpend: number
  impressions: number
  cpa: number
  ctr: number
  frequency: number
  adsCount: number
}
