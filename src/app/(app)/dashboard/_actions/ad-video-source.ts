"use server"

import { getAdVideoSource as getAdVideoSourceService } from "@/lib/services/meta/ad-video-source"
import { withMetaDashboardAccount } from "@/lib/services/meta/meta-dashboard-account.server"
import { createServerAction } from "@/lib/server-action"

export const getAdVideoSource = createServerAction(
  async (
    input: string | { adId: string; accountId?: string }
  ): Promise<{ sourceUrl: string | null; embedUrl: string | null }> => {
    const adId = typeof input === "string" ? input : input.adId
    const accountId = typeof input === "string" ? undefined : input.accountId
    return withMetaDashboardAccount(accountId, () => getAdVideoSourceService(adId))
  }
)
