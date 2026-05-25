"use server"

import { createServerAction } from "@/lib/server-action"
import {
  createLandingPage,
  listLandingPages,
  type LandingPageRecord,
} from "@/lib/services/landing-page"

export const listCampaignLandingPagesCatalogAction = createServerAction(
  async (): Promise<LandingPageRecord[]> => listLandingPages()
)

export const createCampaignLandingPageAction = createServerAction(
  async (input: { url: string }): Promise<LandingPageRecord> =>
    createLandingPage(input)
)
