"use server"

import { createServerAction } from "@/lib/server-action"
import { listCreatives, type CreativeRecord } from "@/lib/services/creative"

export const listCreativesAction = createServerAction(
  async (): Promise<CreativeRecord[]> => listCreatives()
)
