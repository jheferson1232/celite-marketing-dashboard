"use server"

import { createServerAction } from "@/lib/server-action"
import {
  launchTikTokCampaignFromProduct,
  previewLaunchFromProduct,
} from "@/lib/services/tiktok/launch-from-product"
import { getDefaultVideosDirectory } from "@/lib/services/tiktok/video-path"

export const getProductLaunchVideosDirPreferenceAction = createServerAction(
  async () => getDefaultVideosDirectory()
)

export const previewLaunchFromProductAction = createServerAction(
  async (input: { productId: string; videosDir: string }) =>
    previewLaunchFromProduct(input.productId, input.videosDir)
)

export const launchFromProductAction = createServerAction(
  async (input: { productId: string; videosDir: string }) =>
    launchTikTokCampaignFromProduct(input.productId, {
      videosDir: input.videosDir,
    })
)
