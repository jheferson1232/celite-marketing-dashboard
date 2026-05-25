"use server"

import { createServerAction } from "@/lib/server-action"
import {
  createLandingPageForProduct,
  getLandingPageCampaignUsage,
  linkLandingPageToProduct,
  listAvailableLandingPagesForProduct,
  listLandingPagesForProduct,
  unlinkLandingPageFromProduct,
  type LandingPageCampaignUsage,
  type LandingPageRecord,
} from "@/lib/services/landing-page"

export const listProductLandingPagesAction = createServerAction(
  async (productId: string): Promise<LandingPageRecord[]> =>
    listLandingPagesForProduct(productId)
)

export const listAvailableProductLandingPagesAction = createServerAction(
  async (productId: string): Promise<LandingPageRecord[]> =>
    listAvailableLandingPagesForProduct(productId)
)

export const getLandingPageCampaignUsageAction = createServerAction(
  async (landingPageId: string): Promise<LandingPageCampaignUsage[]> =>
    getLandingPageCampaignUsage(landingPageId)
)

export const createProductLandingPageAction = createServerAction(
  async (input: { productId: string; url: string }): Promise<LandingPageRecord> =>
    createLandingPageForProduct(input)
)

export const linkProductLandingPageAction = createServerAction(
  async (input: {
    productId: string
    landingPageId: string
  }): Promise<LandingPageRecord> => linkLandingPageToProduct(input)
)

export const unlinkProductLandingPageAction = createServerAction(
  async (input: { productId: string; landingPageId: string }): Promise<void> =>
    unlinkLandingPageFromProduct(input)
)
