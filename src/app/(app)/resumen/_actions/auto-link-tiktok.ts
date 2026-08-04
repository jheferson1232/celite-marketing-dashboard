"use server"

import { createServerAction } from "@/lib/server-action"
import { autoLinkTikTokCampaignsToProducts } from "@/lib/services/product/auto-link-tiktok-campaigns"

export const autoLinkTikTokCampaignsAction = createServerAction(async () =>
  autoLinkTikTokCampaignsToProducts()
)
