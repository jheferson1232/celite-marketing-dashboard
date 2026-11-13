/** `cron_2h` queda solo en el historial: hoy el agente se ejecuta a mano. */
export type TikTokCommentAgentTrigger = "cron_2h" | "manual"

export type TikTokCommentClassification =
  | "spam"
  | "troll"
  | "question"
  | "positive"
  | "neutral"

export type TikTokCommentActionKind = "hide" | "reply" | "skip"

export type TikTokCommentDateRange = "today" | "7d"

export type TikTokCommentActivityFilter =
  | "all"
  | "replies"
  | "hidden"
  | "skipped"
  | "errors"

export type TikTokCommentAgentRunSummary = {
  runId: string
  trigger: TikTokCommentAgentTrigger
  status: "running" | "success" | "failed"
  startedAt: string
  finishedAt: string | null
  adsScanned: number
  commentsSeen: number
  actionsCount: number
  summary: string | null
  errorMessage: string | null
}

export type TikTokCommentDecisionRecord = {
  id: string
  runId: string | null
  tiktokCommentId: string
  adId: string | null
  accountId: string | null
  tiktokItemId: string | null
  identityId: string | null
  identityType: string | null
  authorName: string | null
  message: string
  classification: TikTokCommentClassification
  action: TikTokCommentActionKind
  replyText: string | null
  applied: boolean
  errorMessage: string | null
  createdAt: string
}

export type TikTokCommentDashboardMetrics = {
  range: TikTokCommentDateRange
  processed: number
  replied: number
  hidden: number
  skipped: number
  errors: number
  /** Ads Spark revisados en la última corrida exitosa (sin llamar a TikTok). */
  monitoredAds: number
}

export type TikTokCommentAgentStatus = {
  aiConfigured: boolean
  aiModelLabel: string
  tiktokConfigured: boolean
  /** Cuentas TikTok Ads activas que recorre el agente. */
  accountsCount: number
  missing: string[]
}

export type TikTokActiveAdRef = {
  adId: string
  adName: string
  adgroupId: string | null
  tiktokItemId: string | null
  identityId: string | null
  identityType: string | null
  videoId: string | null
  profileName: string | null
  isSparkTarget: boolean
  accountId: string | null
  accountName: string | null
}

/** TikTok solo permite search_field=ADGROUP_ID en /comment/list/. */
export type TikTokCommentSearchUnit = {
  adgroupId: string
  /** Primer ad del conjunto (fallback cuando el comentario no trae ad_id). */
  ad: TikTokActiveAdRef
  /** Todos los ads del conjunto: en CBO multi-video cada ad es otro post. */
  ads: TikTokActiveAdRef[]
}

export type TikTokFetchedComment = {
  id: string
  message: string
  createdTime: string
  authorName: string | null
  status: string | null
  adId: string | null
}

export type TikTokLiveComment = TikTokFetchedComment & {
  adId: string
  adName: string
  adgroupId: string | null
  profileName: string | null
  tiktokItemId: string | null
  accountName: string | null
  processed: boolean
}

export type TikTokEnableCommentsResult = {
  adgroupsTargeted: number
  updated: number
  failed: Array<{ adgroupId: string; error: string }>
}
