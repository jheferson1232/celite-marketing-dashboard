"use server"

import { getCreativeVideoSource as getCreativeVideoSourceService } from "@/lib/services/meta/creative-video-source"
import { createServerAction } from "@/lib/server-action"

export const getCreativeVideoSource = createServerAction(
  async (videoId: string): Promise<string | null> => {
    return getCreativeVideoSourceService(videoId)
  }
)
