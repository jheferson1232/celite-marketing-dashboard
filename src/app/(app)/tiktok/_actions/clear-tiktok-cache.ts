"use server"

import { clearTikTokCache } from "@/lib/services/tiktok/tiktok-cache"
import { createServerAction } from "@/lib/server-action"

export const clearTikTokCacheAction = createServerAction(async () => {
  clearTikTokCache()
})
