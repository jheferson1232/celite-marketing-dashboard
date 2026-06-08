import { metaGraphGet } from "../meta-graph-retry"
import { META_COMMENT_WINDOW_HOURS } from "./constants"
import type { MetaFetchedComment } from "./types"

type MetaCommentRow = {
  id: string
  message?: string
  created_time?: string
  from?: { name?: string }
  can_hide?: boolean
  can_comment?: boolean
}

type MetaPagedResponse<T> = {
  data: T[]
  paging?: { next?: string }
}

function buildGraphEdgeUrl(
  objectId: string,
  edge: string,
  params: Record<string, string>,
  token: string
): string {
  const url = new URL(
    `https://graph.facebook.com/v25.0/${objectId}/${edge}`
  )
  url.searchParams.set("access_token", token)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function sinceUnixSeconds(): string {
  const since = Date.now() - META_COMMENT_WINDOW_HOURS * 60 * 60 * 1000
  return String(Math.floor(since / 1000))
}

async function fetchCommentPages(
  postStoryId: string,
  pageAccessToken: string
): Promise<MetaCommentRow[]> {
  const items: MetaCommentRow[] = []
  const firstUrl = buildGraphEdgeUrl(postStoryId, "comments", {
    fields: "id,message,created_time,from,can_hide,can_comment",
    filter: "stream",
    since: sinceUnixSeconds(),
    limit: "100",
  }, pageAccessToken)

  let response = await metaGraphGet<MetaPagedResponse<MetaCommentRow>>(firstUrl)
  items.push(...(response.data ?? []))

  let nextUrl = response.paging?.next
  let pageCount = 1
  const maxPages = 5

  while (nextUrl && pageCount < maxPages) {
    response = await metaGraphGet<MetaPagedResponse<MetaCommentRow>>(nextUrl)
    items.push(...(response.data ?? []))
    nextUrl = response.paging?.next
    pageCount += 1
  }

  return items
}

/** Comentarios recientes de un post de anuncio (ventana 24h). */
export async function fetchRecentPostComments(
  postStoryId: string,
  pageAccessToken: string
): Promise<MetaFetchedComment[]> {
  const rows = await fetchCommentPages(postStoryId, pageAccessToken)

  return rows
    .filter((row) => row.id && row.message?.trim())
    .map((row) => ({
      id: row.id,
      message: row.message!.trim(),
      createdTime: row.created_time ?? new Date().toISOString(),
      authorName: row.from?.name?.trim() ?? null,
      canHide: row.can_hide ?? false,
      canReply: row.can_comment ?? false,
    }))
}
