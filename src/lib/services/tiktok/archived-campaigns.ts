import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"

export type ArchivedTikTokCampaign = {
  campaignId: string
  name: string
  archivedAt: string
}

function assertSettings() {
  if (!prisma.tikTokDashboardSettings) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado. Redeploy o reiniciá tras prisma generate."
    )
  }
}

function parseArchived(
  raw: string | null | undefined
): ArchivedTikTokCampaign[] {
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
          archivedAt:
            typeof row.archivedAt === "string" && row.archivedAt
              ? row.archivedAt
              : new Date().toISOString(),
        } satisfies ArchivedTikTokCampaign
      })
      .filter((item): item is ArchivedTikTokCampaign => item != null)
  } catch {
    return []
  }
}

async function readArchivedRaw(): Promise<string> {
  assertSettings()
  const row = await prisma.tikTokDashboardSettings.findUnique({
    where: { id: "default" },
  })
  return row?.archivedCampaigns ?? "[]"
}

async function writeArchived(items: ArchivedTikTokCampaign[]): Promise<void> {
  assertSettings()
  await prisma.tikTokDashboardSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      archivedCampaigns: JSON.stringify(items),
    },
    update: {
      archivedCampaigns: JSON.stringify(items),
    },
  })
}

export async function listArchivedTikTokCampaigns(): Promise<
  ArchivedTikTokCampaign[]
> {
  return parseArchived(await readArchivedRaw())
}

export async function archiveTikTokCampaign(input: {
  campaignId: string
  name: string
}): Promise<ArchivedTikTokCampaign[]> {
  const campaignId = input.campaignId.trim()
  if (!campaignId) {
    throw new ServerActionError("Falta el id de la campaña.")
  }
  const current = await listArchivedTikTokCampaigns()
  if (current.some((item) => item.campaignId === campaignId)) {
    return current
  }
  const next = [
    {
      campaignId,
      name: input.name.trim() || campaignId,
      archivedAt: new Date().toISOString(),
    },
    ...current,
  ]
  await writeArchived(next)
  return next
}

export async function unarchiveTikTokCampaign(
  campaignId: string
): Promise<ArchivedTikTokCampaign[]> {
  const id = campaignId.trim()
  if (!id) {
    throw new ServerActionError("Falta el id de la campaña.")
  }
  const next = (await listArchivedTikTokCampaigns()).filter(
    (item) => item.campaignId !== id
  )
  await writeArchived(next)
  return next
}
