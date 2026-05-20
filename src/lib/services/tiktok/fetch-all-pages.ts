import { getTikTokAdvertiserId, getTikTokClient } from "./tiktok"
import type { TikTokApiResponse, TikTokListResponse } from "./types"

export async function fetchAllPages<T>(
  path: string,
  extraParams: Record<string, string> = {}
): Promise<T[]> {
  const api = getTikTokClient()
  const advertiserId = getTikTokAdvertiserId()
  const items: T[] = []
  let page = 1
  let totalPage = 1

  while (page <= totalPage) {
    const { data } = await api.get<TikTokApiResponse<TikTokListResponse<T>>>(
      path,
      {
        params: {
          advertiser_id: advertiserId,
          page,
          page_size: 500,
          ...extraParams,
        },
      }
    )

    items.push(...(data.data.list ?? []))
    totalPage = data.data.page_info?.total_page ?? 1
    page += 1
  }

  return items
}
