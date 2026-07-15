"use server"

import { createServerAction } from "@/lib/server-action"
import type { ABODynamicFields } from "@/lib/config/tiktok-strategies"
import type { TikTokStrategyId } from "@/lib/config/tiktok-strategies"
import type { CampaignStatus } from "@/lib/campaigns/status"
import {
  createCampaign,
  deleteCampaign,
  getCampaignById,
  listCampaigns,
  updateCampaignABOConfig,
  updateCampaignDetail,
  updateCampaignGeneral,
  updateCampaignStatus,
  updateCampaignStrategy,
  type CampaignRecord,
  type UpdateCampaignABOInput,
} from "@/lib/services/campaign"
import {
  listCampaignsForKanban,
  type CampaignKanbanRecord,
} from "@/lib/services/campaign-kanban-outcomes"

export const listCampaignsAction = createServerAction(
  async (): Promise<CampaignRecord[]> => listCampaigns()
)

export const listCampaignsForKanbanAction = createServerAction(
  async (): Promise<CampaignKanbanRecord[]> => listCampaignsForKanban()
)

export const getCampaignByIdAction = createServerAction(
  async (id: string): Promise<CampaignRecord | null> => getCampaignById(id)
)

export const createCampaignAction = createServerAction(
  async (input: {
    name: string
    status?: CampaignStatus
    strategy: TikTokStrategyId
    pixelId?: string
    authCode?: string
    aboDynamic?: ABODynamicFields
    aboLandingPages?: UpdateCampaignABOInput["landingPages"]
    aboCreatives?: UpdateCampaignABOInput["creatives"]
  }): Promise<CampaignRecord> =>
    createCampaign({
      name: input.name,
      status: input.status,
      strategy: input.strategy,
      pixelId: input.pixelId,
      authCode: input.authCode,
      ...(input.aboDynamic &&
      input.aboLandingPages &&
      input.aboCreatives
        ? {
            abo: {
              dynamic: input.aboDynamic,
              landingPages: input.aboLandingPages,
              creatives: input.aboCreatives,
            },
          }
        : {}),
    })
)

export const updateCampaignStatusAction = createServerAction(
  async (input: {
    campaignId: string
    status: CampaignStatus
  }): Promise<CampaignRecord> =>
    updateCampaignStatus(input.campaignId, input.status)
)

export const updateCampaignStrategyAction = createServerAction(
  async (input: {
    campaignId: string
    strategy: TikTokStrategyId
  }): Promise<CampaignRecord> =>
    updateCampaignStrategy(input.campaignId, input.strategy)
)

export const updateCampaignABOConfigAction = createServerAction(
  async (input: {
    campaignId: string
  } & UpdateCampaignABOInput): Promise<CampaignRecord> =>
    updateCampaignABOConfig(input.campaignId, {
      dynamic: input.dynamic,
      landingPages: input.landingPages,
      creatives: input.creatives,
    })
)

export const updateCampaignGeneralAction = createServerAction(
  async (input: {
    campaignId: string
    name: string
    status: CampaignStatus
  }): Promise<CampaignRecord> =>
    updateCampaignGeneral(input.campaignId, {
      name: input.name,
      status: input.status,
    })
)

export const updateCampaignDetailAction = createServerAction(
  async (input: {
    campaignId: string
    name: string
    status: CampaignStatus
    pixelId?: string
    authCode?: string
    aboDynamic?: ABODynamicFields
    aboLandingPages?: UpdateCampaignABOInput["landingPages"]
    aboCreatives?: UpdateCampaignABOInput["creatives"]
  }): Promise<CampaignRecord> =>
    updateCampaignDetail(input.campaignId, {
      name: input.name,
      status: input.status,
      pixelId: input.pixelId,
      authCode: input.authCode,
      ...(input.aboDynamic &&
      input.aboLandingPages &&
      input.aboCreatives
        ? {
            abo: {
              dynamic: input.aboDynamic,
              landingPages: input.aboLandingPages,
              creatives: input.aboCreatives,
            },
          }
        : {}),
    })
)

export const deleteCampaignAction = createServerAction(
  async (campaignId: string): Promise<void> => deleteCampaign(campaignId)
)

export const listTikTokStrategiesAction = createServerAction(async () => {
  const { listTikTokStrategies } = await import("@/lib/config/tiktok-strategies")
  return listTikTokStrategies().map((strategy) => ({
    id: strategy.id,
    label: strategy.label,
    description: strategy.description,
  }))
})

export const listTikTokPixelsAction = createServerAction(async () => {
  const { listTikTokPixels } = await import("@/lib/services/tiktok/pixels")
  return listTikTokPixels()
})

export const listTikTokAdVideosAction = createServerAction(async () => {
  const { listTikTokSparkPosts } = await import(
    "@/lib/services/tiktok/spark-posts"
  )
  return listTikTokSparkPosts()
})

export const previewSparkAuthCodeAction = createServerAction(
  async (authCode: string) => {
    const { getSparkVideoFromAuthCode } = await import(
      "@/lib/services/tiktok/spark-auth-video"
    )
    return getSparkVideoFromAuthCode(authCode)
  }
)

export const previewLaunchFromCampaignAction = createServerAction(
  async (campaignId: string) => {
    const { previewLaunchFromCampaign } = await import(
      "@/lib/services/tiktok/launch-from-campaign"
    )
    return previewLaunchFromCampaign(campaignId)
  }
)

export const launchCampaignFromCampaignAction = createServerAction(
  async (campaignId: string) => {
    const { launchTikTokCampaignFromCampaign } = await import(
      "@/lib/services/tiktok/launch-from-campaign"
    )
    return launchTikTokCampaignFromCampaign(campaignId)
  }
)

export const getCampaignLaunchProgressAction = createServerAction(
  async (campaignId: string) => {
    const { getLaunchProgress } = await import(
      "@/lib/services/tiktok/launch-progress"
    )
    return getLaunchProgress(campaignId)
  }
)
