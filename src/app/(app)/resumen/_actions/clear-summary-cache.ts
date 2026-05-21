"use server"

import { createServerAction } from "@/lib/server-action"
import { clearMetaCache } from "@/lib/services/meta/meta-cache"
import { clearTikTokCache } from "@/lib/services/tiktok/tiktok-cache"

export const clearSummaryCacheAction = createServerAction(async () => {
  clearMetaCache()
  clearTikTokCache()
})
