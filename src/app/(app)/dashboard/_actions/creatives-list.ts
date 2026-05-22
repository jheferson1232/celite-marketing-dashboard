"use server"

import axios from "axios"
import { createServerAction } from "@/lib/server-action"
import {
  fetchAdImageUrlsByHash,
  fetchAdVideoPicturesById,
  pickDisplayImageUrl,
  resolveCreativeMediaUrls,
} from "@/lib/services/meta/creative-media"
import { getMetaClient } from "@/lib/services/meta/meta"
import type {
  CreativeRow,
  DateRange,
  MetaAdCreative,
  MetaAdInsightRow,
  MetaAdWithExpandedInsights,
  MetaAdWithExpandedInsightsResponse,
} from "@/lib/services/meta/types"

const PURCHASE_ACTION_TYPE = "omni_purchase"

interface CreativeAggregate {
  creative: MetaAdCreative
  totalSpend: number
  impressions: number
  clicks: number
  frequencyWeighted: number
  purchases: number
  adIds: Set<string>
}

function getAssetKey(creative: MetaAdCreative): string {
  if (creative.video_id) return `video:${creative.video_id}`
  if (creative.image_hash) return `image:${creative.image_hash}`
  return `creative:${creative.id}`
}

async function fetchAdsWithCreativeAndInsights(
  dateRange: DateRange
): Promise<MetaAdWithExpandedInsights[]> {
  const api = getMetaClient()
  const ads: MetaAdWithExpandedInsights[] = []

  const response = await api.get<MetaAdWithExpandedInsightsResponse>("/ads", {
    params: {
      fields:
        "creative{id,name,thumbnail_url,image_url,image_hash,video_id,body,title," +
        "object_story_spec{photo_data{url,image_hash},video_data{video_id,image_url}," +
        "link_data{picture,image_url}}}," +
        "insights{spend,impressions,clicks,ctr,frequency,actions,cost_per_action_type}",
      "time_range[since]": dateRange.from,
      "time_range[until]": dateRange.to,
      limit: "100",
    },
  })

  ads.push(...response.data.data)

  let nextUrl = response.data.paging?.next
  while (nextUrl) {
    const nextResponse =
      await axios.get<MetaAdWithExpandedInsightsResponse>(nextUrl)
    ads.push(...nextResponse.data.data)
    nextUrl = nextResponse.data.paging?.next
  }

  return ads
}

function getPurchases(actions?: MetaAdInsightRow["actions"]): number {
  return parseInt(
    actions?.find((action) => action.action_type === PURCHASE_ACTION_TYPE)
      ?.value || "0",
    10
  )
}

export const getCreativesList = createServerAction(
  async (dateRange: DateRange): Promise<CreativeRow[]> => {
    const ads = await fetchAdsWithCreativeAndInsights(dateRange)
    const aggregates = new Map<string, CreativeAggregate>()

    for (const ad of ads) {
      const creative = ad.creative
      const insight = ad.insights?.data?.[0]
      if (!creative?.id || !insight) continue

      const spend = parseFloat(insight.spend || "0")
      const impressions = parseInt(insight.impressions || "0", 10)
      const clicks = parseInt(insight.clicks || "0", 10)
      const frequency = parseFloat(insight.frequency || "0")
      const purchases = getPurchases(insight.actions)

      const assetKey = getAssetKey(creative)
      const existing = aggregates.get(assetKey)

      if (existing) {
        existing.totalSpend += spend
        existing.impressions += impressions
        existing.clicks += clicks
        existing.frequencyWeighted += frequency * impressions
        existing.purchases += purchases
        existing.adIds.add(ad.id)
        continue
      }

      aggregates.set(assetKey, {
        creative,
        totalSpend: spend,
        impressions,
        clicks,
        frequencyWeighted: frequency * impressions,
        purchases,
        adIds: new Set([ad.id]),
      })
    }

    const imageHashes = [...aggregates.values()].flatMap(({ creative }) => {
      const hashes: string[] = []
      if (creative.image_hash) hashes.push(creative.image_hash)
      const specHash = creative.object_story_spec?.photo_data?.image_hash
      if (specHash) hashes.push(specHash)
      return hashes
    })

    const videoIds = [...aggregates.values()]
      .map(({ creative }) => creative.video_id)
      .filter((id): id is string => Boolean(id))

    const [imageHashMap, videoPictureMap] = await Promise.all([
      fetchAdImageUrlsByHash(imageHashes),
      fetchAdVideoPicturesById(videoIds),
    ])

    return [...aggregates.values()]
      .map(
        ({
          creative,
          totalSpend,
          impressions,
          clicks,
          frequencyWeighted,
          purchases,
          adIds,
        }) => {
          const mediaType = creative.video_id ? "video" : "image"
          const { thumbnailUrl, imageUrl } = resolveCreativeMediaUrls(
            creative,
            imageHashMap,
            videoPictureMap
          )

          const displayUrl = pickDisplayImageUrl(thumbnailUrl, imageUrl)

          return {
            id: creative.id,
            name: creative.name || creative.title || "Sin nombre",
            thumbnailUrl: displayUrl,
            imageUrl: imageUrl || displayUrl,
            videoId: creative.video_id,
            mediaType,
            totalSpend,
            impressions,
            cpa: purchases > 0 ? totalSpend / purchases : 0,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            frequency: impressions > 0 ? frequencyWeighted / impressions : 0,
            adsCount: adIds.size,
          } satisfies CreativeRow
        }
      )
      .sort((a, b) => b.totalSpend - a.totalSpend)
  }
)
