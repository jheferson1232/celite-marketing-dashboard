import { getMetaClient } from "../meta"
import { fetchAllMetaPages } from "../paginated-fetch"
import type { MetaAdPostRef } from "./types"

type MetaAdRow = {
  id: string
  name?: string
  status?: string
  effective_status?: string
  creative?: {
    effective_object_story_id?: string
    object_story_id?: string
  }
}

function isActiveAd(row: MetaAdRow): boolean {
  const status = (row.effective_status || row.status || "").toUpperCase()
  return status === "ACTIVE"
}

function extractPageIdFromStoryId(storyId: string): string | null {
  const [pageId] = storyId.split("_")
  return pageId?.trim() || null
}

/** Anuncios activos con post de página asociado (effective_object_story_id). */
export async function fetchActiveMetaAdPosts(): Promise<MetaAdPostRef[]> {
  const api = getMetaClient()
  const rows = await fetchAllMetaPages<MetaAdRow>(api, "/ads", {
    fields:
      "id,name,status,effective_status,creative{effective_object_story_id,object_story_id}",
    limit: "100",
  })

  const byStory = new Map<string, MetaAdPostRef>()

  for (const row of rows) {
    if (!isActiveAd(row)) continue

    const storyId =
      row.creative?.effective_object_story_id?.trim() ||
      row.creative?.object_story_id?.trim()
    if (!storyId || byStory.has(storyId)) continue

    byStory.set(storyId, {
      adId: row.id,
      adName: row.name?.trim() || row.id,
      postStoryId: storyId,
      pageId: extractPageIdFromStoryId(storyId),
    })
  }

  return [...byStory.values()]
}
