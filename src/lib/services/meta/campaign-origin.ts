import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import {
  CAMPAIGN_ORIGINS,
  type CampaignOriginRow,
  type CampaignOriginValue,
} from "@/lib/services/campaign-origin.shared"

export {
  CAMPAIGN_ORIGINS as META_CAMPAIGN_ORIGINS,
  CAMPAIGN_ORIGIN_LABELS as META_CAMPAIGN_ORIGIN_LABELS,
  type CampaignOriginRow as MetaCampaignOriginRow,
  type CampaignOriginValue as MetaCampaignOriginValue,
} from "@/lib/services/campaign-origin.shared"

function assertModel() {
  if (!prisma.metaCampaignOrigin) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado. Redeploy o reiniciá tras prisma generate."
    )
  }
}

function parseOrigin(raw: string): CampaignOriginValue | null {
  return CAMPAIGN_ORIGINS.includes(raw as CampaignOriginValue)
    ? (raw as CampaignOriginValue)
    : null
}

export async function listMetaCampaignOrigins(): Promise<CampaignOriginRow[]> {
  assertModel()
  const rows = await prisma.metaCampaignOrigin.findMany()
  return rows.flatMap((row) => {
    const origin = parseOrigin(row.origin)
    if (!origin) return []
    return [{ campaignId: row.campaignId, origin }]
  })
}

export async function setMetaCampaignOrigin(input: {
  campaignId: string
  origin: CampaignOriginValue | null
}): Promise<CampaignOriginRow | null> {
  assertModel()
  const campaignId = input.campaignId.trim()
  if (!campaignId) {
    throw new ServerActionError("Falta el id de la campaña.")
  }

  if (input.origin == null) {
    await prisma.metaCampaignOrigin.deleteMany({ where: { campaignId } })
    return null
  }

  if (!CAMPAIGN_ORIGINS.includes(input.origin)) {
    throw new ServerActionError("Origen inválido.")
  }

  const row = await prisma.metaCampaignOrigin.upsert({
    where: { campaignId },
    create: { campaignId, origin: input.origin },
    update: { origin: input.origin },
  })

  return { campaignId: row.campaignId, origin: input.origin }
}
