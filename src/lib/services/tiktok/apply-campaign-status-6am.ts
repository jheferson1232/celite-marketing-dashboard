import { getTikTokAgentThresholds } from "@/lib/services/tiktok/agent/config"
import {
  queueCampaignFor6amActivation,
  removeCampaignFrom6amQueue,
} from "@/lib/services/tiktok/agent/pending-6am-activation"
import {
  setTikTokCampaignStatusOnly,
  type TikTokOperationStatus,
} from "@/lib/services/tiktok/manage"

export type ApplyCampaignStatusResult = {
  scheduledFor6am: boolean
  campaignOperationStatus: TikTokOperationStatus | "DISABLE"
  message?: string
}

/**
 * Si «Activación 6:00 AM» está on, ENABLE no toca TikTok: encola para las 6:00 Lima.
 * DISABLE saca de la cola y pausa en TikTok.
 */
export async function applyTikTokCampaignStatusWith6amQueue(input: {
  campaignId: string
  name?: string
  operationStatus: TikTokOperationStatus
}): Promise<ApplyCampaignStatusResult> {
  const { campaignId, operationStatus } = input
  const name = input.name?.trim()

  if (operationStatus === "DISABLE") {
    await removeCampaignFrom6amQueue(campaignId)
    const state = await setTikTokCampaignStatusOnly(campaignId, "DISABLE")
    if (state.campaignOperationStatus !== "DISABLE") {
      throw new Error(
        `No se pudo actualizar la campaña en TikTok (estado: ${state.campaignOperationStatus})`
      )
    }
    return {
      scheduledFor6am: false,
      campaignOperationStatus: "DISABLE",
    }
  }

  const thresholds = await getTikTokAgentThresholds()
  if (thresholds.activateAt6amEnabled) {
    await queueCampaignFor6amActivation({ campaignId, name })
    return {
      scheduledFor6am: true,
      campaignOperationStatus: "DISABLE",
      message: "Programada para activarse a las 6:00 AM (Lima).",
    }
  }

  const state = await setTikTokCampaignStatusOnly(campaignId, "ENABLE")
  if (state.campaignOperationStatus !== "ENABLE") {
    throw new Error(
      `No se pudo actualizar la campaña en TikTok (estado: ${state.campaignOperationStatus})`
    )
  }
  return {
    scheduledFor6am: false,
    campaignOperationStatus: "ENABLE",
  }
}
