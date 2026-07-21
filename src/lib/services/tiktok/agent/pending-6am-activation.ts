import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { activateTikTokCampaignComplete } from "@/lib/services/tiktok/manage"
import { getTikTokAgentThresholds } from "./config"

export type PendingActivateCampaign = {
  campaignId: string
  name: string
  queuedAt: string
}

function assertSettings() {
  if (!prisma.tikTokAgentSettings) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado. Redeploy o reiniciá tras prisma generate."
    )
  }
}

function parsePending(raw: string | null | undefined): PendingActivateCampaign[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const row = item as Record<string, unknown>
        const campaignId =
          typeof row.campaignId === "string" ? row.campaignId.trim() : ""
        if (!campaignId) return null
        return {
          campaignId,
          name:
            typeof row.name === "string" && row.name.trim()
              ? row.name.trim()
              : campaignId,
          queuedAt:
            typeof row.queuedAt === "string" && row.queuedAt
              ? row.queuedAt
              : new Date().toISOString(),
        } satisfies PendingActivateCampaign
      })
      .filter((item): item is PendingActivateCampaign => item != null)
  } catch {
    return []
  }
}

async function readPendingRaw(): Promise<string> {
  assertSettings()
  const row = await prisma.tikTokAgentSettings.findUnique({
    where: { id: "default" },
  })
  return row?.pendingActivateCampaignIds ?? "[]"
}

async function writePending(items: PendingActivateCampaign[]): Promise<void> {
  assertSettings()
  await prisma.tikTokAgentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      pendingActivateCampaignIds: JSON.stringify(items),
    },
    update: {
      pendingActivateCampaignIds: JSON.stringify(items),
    },
  })
}

export async function listPendingActivateCampaigns(): Promise<
  PendingActivateCampaign[]
> {
  return parsePending(await readPendingRaw())
}

export async function queueCampaignFor6amActivation(input: {
  campaignId: string
  name?: string
}): Promise<PendingActivateCampaign[]> {
  const campaignId = input.campaignId.trim()
  if (!campaignId) {
    throw new ServerActionError("Falta campaignId")
  }

  const current = parsePending(await readPendingRaw())
  if (current.some((item) => item.campaignId === campaignId)) {
    return current
  }

  const next = [
    ...current,
    {
      campaignId,
      name: input.name?.trim() || campaignId,
      queuedAt: new Date().toISOString(),
    },
  ]
  await writePending(next)
  return next
}

export async function removeCampaignFrom6amQueue(
  campaignId: string
): Promise<PendingActivateCampaign[]> {
  const id = campaignId.trim()
  const next = parsePending(await readPendingRaw()).filter(
    (item) => item.campaignId !== id
  )
  await writePending(next)
  return next
}

export async function isCampaignQueuedFor6am(
  campaignId: string
): Promise<boolean> {
  const id = campaignId.trim()
  return parsePending(await readPendingRaw()).some(
    (item) => item.campaignId === id
  )
}

/**
 * A las 6:00: activa en TikTok todas las campañas en cola (campaña + conjuntos).
 */
export async function runPending6amActivations(input?: {
  dryRun?: boolean
}): Promise<{
  activated: number
  failed: number
  skippedFeatureOff: boolean
  details: Array<{ campaignId: string; name: string; ok: boolean; error?: string }>
}> {
  const thresholds = await getTikTokAgentThresholds()
  if (!thresholds.activateAt6amEnabled) {
    return {
      activated: 0,
      failed: 0,
      skippedFeatureOff: true,
      details: [],
    }
  }

  const pending = parsePending(await readPendingRaw())
  if (pending.length === 0) {
    return {
      activated: 0,
      failed: 0,
      skippedFeatureOff: false,
      details: [],
    }
  }

  const dryRun = input?.dryRun ?? false
  const details: Array<{
    campaignId: string
    name: string
    ok: boolean
    error?: string
  }> = []
  const remaining: PendingActivateCampaign[] = []

  for (const item of pending) {
    if (dryRun) {
      details.push({
        campaignId: item.campaignId,
        name: item.name,
        ok: true,
      })
      continue
    }

    try {
      await activateTikTokCampaignComplete(item.campaignId)
      details.push({
        campaignId: item.campaignId,
        name: item.name,
        ok: true,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al activar"
      details.push({
        campaignId: item.campaignId,
        name: item.name,
        ok: false,
        error: message,
      })
      remaining.push(item)
    }
  }

  if (!dryRun) {
    await writePending(remaining)
  }

  return {
    activated: details.filter((d) => d.ok).length,
    failed: details.filter((d) => !d.ok).length,
    skippedFeatureOff: false,
    details,
  }
}
