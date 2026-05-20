"use server"

import { getAdVideoSource as getAdVideoSourceService } from "@/lib/services/meta/ad-video-source"
import { createServerAction } from "@/lib/server-action"

export const getAdVideoSource = createServerAction(
  async (
    adId: string
  ): Promise<{ sourceUrl: string | null; embedUrl: string | null }> => {
    return getAdVideoSourceService(adId)
  }
)
