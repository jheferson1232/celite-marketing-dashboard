import "server-only"

import { buildTikTokCacheKey, getTikTokRequestContext } from "./tiktok-api.server"
import { withTikTokCache } from "./tiktok-cache"
import type { TikTokApiResponse, TikTokPageInfo } from "./types"

const PIXELS_TTL_MS = 5 * 60 * 1000

export type TikTokPixelSummary = {
  id: string
  name: string
  code: string | null
}

const PIXEL_PAGE_SIZE = 20

interface TikTokPixelApiRow {
  pixel_id: string
  pixel_name?: string
  name?: string
  pixel_code?: string
}

interface TikTokPixelListData {
  pixels?: TikTokPixelApiRow[]
  list?: TikTokPixelApiRow[]
  page_info?: TikTokPageInfo
}

function mapPixelRow(row: TikTokPixelApiRow): TikTokPixelSummary {
  const label = row.pixel_name?.trim() || row.name?.trim()
  return {
    id: row.pixel_id,
    name: label || `Pixel ${row.pixel_id.slice(-6)}`,
    code: row.pixel_code?.trim() || null,
  }
}

async function fetchTikTokPixels(): Promise<TikTokPixelSummary[]> {
  const { client, advertiserId } = await getTikTokRequestContext()
  const items: TikTokPixelApiRow[] = []
  let page = 1
  let totalPage = 1

  while (page <= totalPage) {
    const { data } = await client.get<TikTokApiResponse<TikTokPixelListData>>(
      "/pixel/list/",
      {
        params: {
          advertiser_id: advertiserId,
          page,
          page_size: PIXEL_PAGE_SIZE,
          order_by: "LATEST_CREATE",
        },
      }
    )

    const rows = data.data.pixels ?? data.data.list ?? []
    items.push(...rows)
    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  const byId = new Map<string, TikTokPixelSummary>()
  for (const row of items) {
    if (!row.pixel_id) continue
    byId.set(row.pixel_id, mapPixelRow(row))
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
}

export async function listTikTokPixels(): Promise<TikTokPixelSummary[]> {
  const cacheKey = await buildTikTokCacheKey("pixels")
  return withTikTokCache(cacheKey, PIXELS_TTL_MS, fetchTikTokPixels)
}
