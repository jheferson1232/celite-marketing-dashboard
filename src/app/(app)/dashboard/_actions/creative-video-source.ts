"use server"

import { getCreativeVideoSource as getCreativeVideoSourceService } from "@/lib/services/meta/creative-video-source"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"
import { createServerAction } from "@/lib/server-action"

export const getCreativeVideoSource = createServerAction(
  async (input: string | { videoId: string; accountId?: string }): Promise<string | null> => {
    const videoId = typeof input === "string" ? input : input.videoId
    const accountId = typeof input === "string" ? undefined : input.accountId
    return withMetaDashboardAccount(accountId, () =>
      getCreativeVideoSourceService(videoId)
    )
  }
)
