import { getTikTokAgentThresholds } from "@/lib/services/tiktok/agent/config"
import {
  isCampaignQueuedFor6am,
  queueCampaignFor6amActivation,
  removeCampaignFrom6amQueue,
} from "@/lib/services/tiktok/agent/pending-6am-activation"
import {
  activateTikTokCampaignComplete,
  setTikTokCampaignStatusOnly,
  type TikTokOperationStatus,
} from "@/lib/services/tiktok/manage"

export type ApplyCampaignStatusResult = {
  scheduledFor6am: boolean
  campaignOperationStatus: TikTokOperationStatus | "DISABLE"
  message?: string
}

/**
 * Si «Activación 6:00 AM» está on, el primer ENABLE encola (no toca TikTok).
 * Si ya estaba en cola, un nuevo ENABLE la activa ya (escape manual).
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
    const alreadyQueued = await isCampaignQueuedFor6am(campaignId)
    if (alreadyQueued) {
      await removeCampaignFrom6amQueue(campaignId)
      const state = await activateTikTokCampaignComplete(campaignId)
      if (state.campaignOperationStatus !== "ENABLE") {
        throw new Error(
          `No se pudo actualizar la campaña en TikTok (estado: ${state.campaignOperationStatus})`
        )
      }
      return {
        scheduledFor6am: false,
        campaignOperationStatus: "ENABLE",
        message: "Activada ahora en TikTok.",
      }
    }
    await queueCampaignFor6amActivation({ campaignId, name })
    return {
      scheduledFor6am: true,
      campaignOperationStatus: "DISABLE",
      message: "Programada para activarse a las 6:00 AM (Lima).",
    }
  }

  await removeCampaignFrom6amQueue(campaignId)
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
