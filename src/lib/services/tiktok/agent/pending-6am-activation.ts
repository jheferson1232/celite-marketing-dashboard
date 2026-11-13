import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
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

/** Reemplaza la cola completa (la usa también el cron `/crons/tiktok-activate-6am`). */
export async function writePendingActivateCampaigns(
  items: PendingActivateCampaign[]
): Promise<void> {
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
  const thresholds = await getTikTokAgentThresholds()
  // Si la feature está off, no tratar campañas como “en cola” en el dashboard
  // (evita switches bloqueados con etiqueta 6:00 AM).
  if (!thresholds.activateAt6amEnabled) return []
  return parsePending(await readPendingRaw())
}

/** Lista cruda de la cola (ignora si la feature está on/off). */
export async function listPendingActivateCampaignsRaw(): Promise<
  PendingActivateCampaign[]
> {
  return parsePending(await readPendingRaw())
}

export async function clearPendingActivateCampaigns(): Promise<void> {
  await writePendingActivateCampaigns([])
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
  await writePendingActivateCampaigns(next)
  return next
}

export async function removeCampaignFrom6amQueue(
  campaignId: string
): Promise<PendingActivateCampaign[]> {
  const id = campaignId.trim()
  const next = parsePending(await readPendingRaw()).filter(
    (item) => item.campaignId !== id
  )
  await writePendingActivateCampaigns(next)
  return next
}

export async function isCampaignQueuedFor6am(
  campaignId: string
): Promise<boolean> {
  const pending = await listPendingActivateCampaigns()
  const id = campaignId.trim()
  return pending.some((item) => item.campaignId === id)
}
