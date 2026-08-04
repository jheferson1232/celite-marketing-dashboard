"use server"

import { revalidateTag, updateTag } from "next/cache"
import { clearMetaCache } from "@/lib/services/meta/meta-cache"
import { META_DATA_CACHE_TAG } from "@/lib/services/meta/meta-graph-fetch"
import { createServerAction } from "@/lib/server-action"

export const clearMetaCacheAction = createServerAction(async () => {
  clearMetaCache()
  updateTag(META_DATA_CACHE_TAG)
  revalidateTag(META_DATA_CACHE_TAG, { expire: 0 })
})
