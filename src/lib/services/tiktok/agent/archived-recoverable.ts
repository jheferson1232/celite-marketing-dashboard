import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"

export type ArchivedRecoverableCampaign = {
  campaignId: string
  name: string
  archivedAt: string
}

function assertSettings() {
  if (!prisma.tikTokAgentSettings) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado. Redeploy o reiniciá tras prisma generate."
    )
  }
}

function parseArchived(
  raw: string | null | undefined
): ArchivedRecoverableCampaign[] {
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
        } satisfies ArchivedRecoverableCampaign
      })
      .filter((item): item is ArchivedRecoverableCampaign => item != null)
  } catch {
    return []
  }
}

async function readArchivedRaw(): Promise<string> {
  assertSettings()
  const row = await prisma.tikTokAgentSettings.findUnique({
    where: { id: "default" },
  })
  return row?.archivedRecoverableCampaigns ?? "[]"
}

async function writeArchived(
  items: ArchivedRecoverableCampaign[]
): Promise<void> {
  assertSettings()
  await prisma.tikTokAgentSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      archivedRecoverableCampaigns: JSON.stringify(items),
    },
    update: {
      archivedRecoverableCampaigns: JSON.stringify(items),
    },
  })
}

export async function listArchivedRecoverableCampaigns(): Promise<
  ArchivedRecoverableCampaign[]
> {
  return parseArchived(await readArchivedRaw())
}

export async function getArchivedRecoverableCampaignIds(): Promise<Set<string>> {
  const items = await listArchivedRecoverableCampaigns()
  return new Set(items.map((item) => item.campaignId))
}

export async function archiveRecoverableCampaign(input: {
  campaignId: string
  name: string
}): Promise<ArchivedRecoverableCampaign[]> {
  const campaignId = input.campaignId.trim()
  if (!campaignId) {
    throw new ServerActionError("Falta el id de la campaña.")
  }
  const current = await listArchivedRecoverableCampaigns()
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

export async function unarchiveRecoverableCampaign(
  campaignId: string
): Promise<ArchivedRecoverableCampaign[]> {
  const id = campaignId.trim()
  if (!id) {
    throw new ServerActionError("Falta el id de la campaña.")
  }
  const next = (await listArchivedRecoverableCampaigns()).filter(
    (item) => item.campaignId !== id
  )
  await writeArchived(next)
  return next
}
