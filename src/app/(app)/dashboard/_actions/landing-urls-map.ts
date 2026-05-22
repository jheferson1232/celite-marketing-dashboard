"use server"

import { createServerAction } from "@/lib/server-action"
import { getMetaLandingUrlsByCampaignMap } from "@/lib/services/meta/landing-urls-map"

export const getMetaLandingUrlsMapAction = createServerAction(() =>
  getMetaLandingUrlsByCampaignMap()
)
