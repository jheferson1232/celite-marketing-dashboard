"use server"

import { createServerAction } from "@/lib/server-action"
import {
  listMetaCampaignProductLinks,
  type MetaCampaignProductLink,
} from "@/lib/services/product"

export const listMetaCampaignProductLinksAction = createServerAction(
  async (): Promise<MetaCampaignProductLink[]> => listMetaCampaignProductLinks()
)
