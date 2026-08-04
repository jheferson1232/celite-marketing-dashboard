"use server"

import { revalidateTag, updateTag } from "next/cache"
import { createServerAction } from "@/lib/server-action"
import { clearMetaCache } from "@/lib/services/meta/meta-cache"
import { META_DATA_CACHE_TAG } from "@/lib/services/meta/meta-graph-fetch"
import { clearTikTokCache } from "@/lib/services/tiktok/tiktok-cache"

export const clearSummaryCacheAction = createServerAction(async () => {
  clearMetaCache()
  clearTikTokCache()
  // La Graph API de Meta usa fetch con tag meta-data (hasta 30 min).
  // Sin esto, Reload solo limpia la caché en memoria y sigue sirviendo datos viejos.
  updateTag(META_DATA_CACHE_TAG)
  revalidateTag(META_DATA_CACHE_TAG, { expire: 0 })
})
