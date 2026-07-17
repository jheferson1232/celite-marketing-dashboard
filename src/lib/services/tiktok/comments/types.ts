export type TikTokCommentAgentTrigger = "cron_2h" | "manual"

export type TikTokCommentClassification =
  | "spam"
  | "troll"
  | "question"
  | "positive"
  | "neutral"

export type TikTokCommentActionKind = "hide" | "reply" | "skip"

export type TikTokCommentDateRange = "today" | "7d"

export type TikTokCommentActivityFilter = "all" | "replies" | "deleted"

export type TikTokCommentAgentRunSummary = {
  runId: string
  trigger: TikTokCommentAgentTrigger
  status: "running" | "success" | "failed"
  dryRun: boolean
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
  totalActivity: number
  deletedComments: number
  repliedComments: number
  errors: number
  monitoredAds: number
}

export type TikTokCommentAgentStatus = {
  anthropicConfigured: boolean
  tiktokConfigured: boolean
  advertiserId: string | null
  advertiserName: string | null
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
}

/** TikTok solo permite search_field=ADGROUP_ID en /comment/list/. */
export type TikTokCommentSearchUnit = {
  adgroupId: string
  ad: TikTokActiveAdRef
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
  processed: boolean
}

export type TikTokEnableCommentsResult = {
  adgroupsTargeted: number
  updated: number
  failed: Array<{ adgroupId: string; error: string }>
}
