import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import {
  TIKTOK_CAMPAIGN_LAUNCH_SOURCES,
  type TikTokCampaignLaunchSourceRow,
  type TikTokCampaignLaunchSourceValue,
} from "./campaign-launch-source.shared"

export {
  TIKTOK_CAMPAIGN_LAUNCH_SOURCES,
  TIKTOK_CAMPAIGN_LAUNCH_SOURCE_LABELS,
  type TikTokCampaignLaunchSourceRow,
  type TikTokCampaignLaunchSourceValue,
} from "./campaign-launch-source.shared"

function assertModel() {
  if (!prisma.tikTokCampaignLaunchSource) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado. Redeploy o reiniciá tras prisma generate."
    )
  }
}

function parseSource(raw: string): TikTokCampaignLaunchSourceValue | null {
  return TIKTOK_CAMPAIGN_LAUNCH_SOURCES.includes(
    raw as TikTokCampaignLaunchSourceValue
  )
    ? (raw as TikTokCampaignLaunchSourceValue)
    : null
}

function toRow(row: {
  campaignId: string
  source: string
  launchedAt: Date
}): TikTokCampaignLaunchSourceRow | null {
  const source = parseSource(row.source)
  if (!source) return null
  return {
    campaignId: row.campaignId,
    source,
    markedAt: row.launchedAt.toISOString(),
  }
}

export async function listTikTokCampaignLaunchSources(): Promise<
  TikTokCampaignLaunchSourceRow[]
> {
  assertModel()
  const rows = await prisma.tikTokCampaignLaunchSource.findMany()
  return rows.flatMap((row) => {
    const mapped = toRow(row)
    return mapped ? [mapped] : []
  })
}

export async function setTikTokCampaignLaunchSource(input: {
  campaignId: string
  source: TikTokCampaignLaunchSourceValue | null
  launchedAt?: Date
}): Promise<TikTokCampaignLaunchSourceRow | null> {
  assertModel()
  const campaignId = input.campaignId.trim()
  if (!campaignId) {
    throw new ServerActionError("Falta el id de la campaña.")
  }

  if (input.source == null) {
    await prisma.tikTokCampaignLaunchSource.deleteMany({ where: { campaignId } })
    return null
  }

  if (!TIKTOK_CAMPAIGN_LAUNCH_SOURCES.includes(input.source)) {
    throw new ServerActionError("Canal de lanzamiento inválido.")
  }

  const launchedAt = input.launchedAt ?? new Date()
  const row = await prisma.tikTokCampaignLaunchSource.upsert({
    where: { campaignId },
    create: {
      campaignId,
      source: input.source,
      launchedAt,
    },
    update: {
      source: input.source,
      ...(input.launchedAt ? { launchedAt: input.launchedAt } : {}),
    },
  })

  return toRow(row)
}

/** Marca una campaña como lanzada desde el dashboard (idempotente). */
export async function markTikTokCampaignLaunchedFromDashboard(
  campaignId: string,
  launchedAt?: Date
): Promise<void> {
  const id = campaignId.trim()
  if (!id) return
  try {
    await setTikTokCampaignLaunchSource({
      campaignId: id,
      source: "dashboard",
      launchedAt,
    })
  } catch (error) {
    console.error(
      "[tiktok] No se pudo marcar launch source dashboard:",
      id,
      error
    )
  }
}

function normalizeCampaignName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

/**
 * Marca como Dashboard las campañas TikTok que coinciden por nombre con
 * campañas internas del kanban (usa createdAt del kanban como fecha del badge),
 * o que ya están linkeadas a un producto.
 */
export async function backfillDashboardLaunchSourcesFromTikTokCampaigns(
  tiktokCampaigns: Array<{ campaign_id: string; campaign_name?: string }>
): Promise<number> {
  if (tiktokCampaigns.length === 0) return 0
  assertModel()

  const [internalCampaigns, productLinks] = await Promise.all([
    prisma.campaign.findMany({ select: { name: true, createdAt: true } }),
    prisma.productCampaign.findMany({
      where: { platform: "tiktok" },
      select: { campaignId: true, createdAt: true },
    }),
  ])

  const createdAtByName = new Map<string, Date>()
  for (const campaign of internalCampaigns) {
    const key = normalizeCampaignName(campaign.name)
    if (!key) continue
    const existing = createdAtByName.get(key)
    if (!existing || campaign.createdAt < existing) {
      createdAtByName.set(key, campaign.createdAt)
    }
  }

  const launchedAtByTikTokId = new Map<string, Date>()

  for (const link of productLinks) {
    if (link.campaignId) {
      launchedAtByTikTokId.set(link.campaignId, link.createdAt)
    }
  }

  for (const campaign of tiktokCampaigns) {
    const name = normalizeCampaignName(campaign.campaign_name || "")
    const createdAt = name ? createdAtByName.get(name) : undefined
    if (createdAt && campaign.campaign_id) {
      // La fecha del kanban tiene prioridad sobre el link a producto.
      launchedAtByTikTokId.set(campaign.campaign_id, createdAt)
    }
  }

  if (launchedAtByTikTokId.size === 0) return 0

  let written = 0
  try {
    for (const [campaignId, launchedAt] of launchedAtByTikTokId) {
      const existing = await prisma.tikTokCampaignLaunchSource.findUnique({
        where: { campaignId },
        select: { source: true, launchedAt: true },
      })

      if (existing?.source === "manual") continue

      if (
        existing?.source === "dashboard" &&
        existing.launchedAt.getTime() === launchedAt.getTime()
      ) {
        continue
      }

      await prisma.tikTokCampaignLaunchSource.upsert({
        where: { campaignId },
        create: {
          campaignId,
          source: "dashboard",
          launchedAt,
        },
        update: {
          source: "dashboard",
          launchedAt,
        },
      })
      written += 1
    }
  } catch (error) {
    console.error("[tiktok] No se pudo backfill launch source:", error)
    return written
  }

  return written
}
