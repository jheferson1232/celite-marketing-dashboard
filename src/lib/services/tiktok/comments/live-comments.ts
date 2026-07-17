import "server-only"

import {
  attachProcessedFlag,
  fetchLiveTikTokAdComments,
} from "./fetch-comments"
import type { TikTokLiveComment } from "./types"

export type TikTokLiveCommentsResult = {
  adsScanned: number
  sparkTargetAds: number
  adgroupsScanned: number
  comments: TikTokLiveComment[]
  fetchErrors: string[]
}

export async function listTikTokLiveComments(): Promise<TikTokLiveCommentsResult> {
  const result = await fetchLiveTikTokAdComments()
  const comments = await attachProcessedFlag(result.comments)
  return {
    adsScanned: result.adsScanned,
    sparkTargetAds: result.sparkTargetAds,
    adgroupsScanned: result.adgroupsScanned,
    comments,
    fetchErrors: result.fetchErrors,
  }
}
