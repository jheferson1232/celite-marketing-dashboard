"use server"

import { clearMetaCache } from "@/lib/services/meta/meta-cache"
import { createServerAction } from "@/lib/server-action"

export const clearMetaCacheAction = createServerAction(async () => {
  clearMetaCache()
})
