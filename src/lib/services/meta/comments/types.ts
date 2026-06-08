export type MetaCommentAgentTrigger = "cron_2h" | "manual"

export type MetaCommentClassification =
  | "spam"
  | "troll"
  | "question"
  | "positive"
  | "neutral"

export type MetaCommentActionKind = "hide" | "reply" | "skip"

export type MetaCommentDateRange = "today" | "7d"

export type MetaCommentActivityFilter = "all" | "replies" | "deleted"

export type MetaCommentReplyMode = "professional" | "friendly" | "concise"

export type MetaCommentAgentRunSummary = {
  runId: string
  trigger: MetaCommentAgentTrigger
  status: "running" | "success" | "failed"
  dryRun: boolean
  startedAt: string
  finishedAt: string | null
  pagesScanned: number
  postsScanned: number
  commentsSeen: number
  actionsCount: number
  summary: string | null
  errorMessage: string | null
}

export type MetaCommentDecisionRecord = {
  id: string
  runId: string | null
  metaCommentId: string
  postStoryId: string | null
  adId: string | null
  pageId: string | null
  pageName: string | null
  authorName: string | null
  message: string
  classification: MetaCommentClassification
  action: MetaCommentActionKind
  replyText: string | null
  applied: boolean
  errorMessage: string | null
  createdAt: string
}

export type MetaCommentDashboardMetrics = {
  range: MetaCommentDateRange
  totalActivity: number
  deletedComments: number
  repliedComments: number
  errors: number
  monitoredPages: number
}

export type MetaMonitoredPageConfig = {
  pageId: string
  pageName: string
  enabled: boolean
  replyMode: MetaCommentReplyMode
  replyTemplate: string | null
  websiteUrl: string | null
  updatedAt: string
}

export type MetaCommentPageMonitoringState = {
  available: MetaMonitoredPageConfig[]
  monitored: MetaMonitoredPageConfig[]
}

export type MetaPageAccess = {
  pageId: string
  pageName: string
  accessToken: string
}

export type MetaAdPostRef = {
  adId: string
  adName: string
  postStoryId: string
  pageId: string | null
}

export type MetaFetchedComment = {
  id: string
  message: string
  createdTime: string
  authorName: string | null
  canHide: boolean
  canReply: boolean
}

export type MetaCommentAgentStatus = {
  anthropicConfigured: boolean
  metaConfigured: boolean
  pageTokenConfigured: boolean
  /** Páginas conectadas via OAuth (BD). */
  oauthConnected: boolean
  oauthPageCount: number
  pageCount: number
  pageNames: string[]
  monitoredCount: number
  missing: string[]
  /** Detalle cuando no se pudieron listar páginas. */
  pageResolveHint: string | null
}

export type MetaCommentPageReplyUpdate = {
  pageId: string
  replyMode?: MetaCommentReplyMode
  replyTemplate?: string | null
  websiteUrl?: string | null
}
