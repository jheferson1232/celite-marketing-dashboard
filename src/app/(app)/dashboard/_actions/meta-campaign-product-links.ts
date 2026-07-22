"use server"

import { createServerAction } from "@/lib/server-action"
import {
  listCampaignProductLinks,
  type CampaignProductLink,
  type ProductPlatform,
} from "@/lib/services/product"

export const listCampaignProductLinksAction = createServerAction(
  async (platform: ProductPlatform): Promise<CampaignProductLink[]> =>
    listCampaignProductLinks(platform)
)

/** @deprecated Usar listCampaignProductLinksAction("meta") */
export const listMetaCampaignProductLinksAction = createServerAction(
  async (): Promise<CampaignProductLink[]> => listCampaignProductLinks("meta")
)
