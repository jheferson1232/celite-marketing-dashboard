"use server"

import { createServerAction } from "@/lib/server-action"

export const getTikTokVideoSourceAction = createServerAction(
  async (videoId: string) => {
    const { getTikTokCreativeVideoSource } = await import(
      "@/lib/services/tiktok/video-source"
    )
    return getTikTokCreativeVideoSource(videoId)
  }
)
