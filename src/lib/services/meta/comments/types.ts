export type MetaCommentAgentTrigger = "cron_2h" | "manual"

export type MetaCommentClassification =
  | "spam"
  | "troll"
  | "question"
  | "positive"
  | "neutral"

export type MetaCommentActionKind = "hide" | "reply" | "skip"

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
  authorName: string | null
  message: string
  classification: MetaCommentClassification
  action: MetaCommentActionKind
  replyText: string | null
  applied: boolean
  errorMessage: string | null
  createdAt: string
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
  pageCount: number
  pageNames: string[]
  missing: string[]
}
