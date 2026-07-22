import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"

export type ArchivedMetaCampaign = {
  campaignId: string
  name: string
  archivedAt: string
}

function assertSettings() {
  if (!prisma.metaDashboardSettings) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado. Redeploy o reiniciá tras prisma generate."
    )
  }
}

function parseArchived(raw: string | null | undefined): ArchivedMetaCampaign[] {
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
        } satisfies ArchivedMetaCampaign
      })
      .filter((item): item is ArchivedMetaCampaign => item != null)
  } catch {
    return []
  }
}

async function readArchivedRaw(): Promise<string> {
  assertSettings()
  const row = await prisma.metaDashboardSettings.findUnique({
    where: { id: "default" },
  })
  return row?.archivedCampaigns ?? "[]"
}

async function writeArchived(items: ArchivedMetaCampaign[]): Promise<void> {
  assertSettings()
  await prisma.metaDashboardSettings.upsert({
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

export async function listArchivedMetaCampaigns(): Promise<
  ArchivedMetaCampaign[]
> {
  return parseArchived(await readArchivedRaw())
}

export async function getArchivedMetaCampaignIds(): Promise<Set<string>> {
  const items = await listArchivedMetaCampaigns()
  return new Set(items.map((item) => item.campaignId))
}

export async function archiveMetaCampaign(input: {
  campaignId: string
  name: string
}): Promise<ArchivedMetaCampaign[]> {
  const campaignId = input.campaignId.trim()
  if (!campaignId) {
    throw new ServerActionError("Falta el id de la campaña.")
  }
  const current = await listArchivedMetaCampaigns()
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

export async function unarchiveMetaCampaign(
  campaignId: string
): Promise<ArchivedMetaCampaign[]> {
  const id = campaignId.trim()
  if (!id) {
    throw new ServerActionError("Falta el id de la campaña.")
  }
  const next = (await listArchivedMetaCampaigns()).filter(
    (item) => item.campaignId !== id
  )
  await writeArchived(next)
  return next
}
