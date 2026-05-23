"use server"

import { createServerAction } from "@/lib/server-action"
import {
  linkProductCampaign,
  unlinkProductCampaign,
  type LinkProductCampaignInput,
  type ProductPlatform,
  type ProductRecord,
} from "@/lib/services/product"

export const linkProductCampaignAction = createServerAction(
  async (input: LinkProductCampaignInput): Promise<ProductRecord> =>
    linkProductCampaign(input)
)

export const unlinkProductCampaignAction = createServerAction(
  async (input: {
    productId: string
    campaignId: string
    platform: ProductPlatform
  }): Promise<ProductRecord> =>
    unlinkProductCampaign(input.productId, input.campaignId, input.platform)
)
