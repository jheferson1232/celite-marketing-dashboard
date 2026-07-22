import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import {
  TIKTOK_CAMPAIGN_ORIGINS,
  type TikTokCampaignOriginRow,
  type TikTokCampaignOriginValue,
} from "./campaign-origin.shared"

export {
  TIKTOK_CAMPAIGN_ORIGINS,
  TIKTOK_CAMPAIGN_ORIGIN_LABELS,
  type TikTokCampaignOriginRow,
  type TikTokCampaignOriginValue,
} from "./campaign-origin.shared"

function assertModel() {
  if (!prisma.tikTokCampaignOrigin) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado. Redeploy o reiniciá tras prisma generate."
    )
  }
}

function parseOrigin(raw: string): TikTokCampaignOriginValue | null {
  return TIKTOK_CAMPAIGN_ORIGINS.includes(raw as TikTokCampaignOriginValue)
    ? (raw as TikTokCampaignOriginValue)
    : null
}

export async function listTikTokCampaignOrigins(): Promise<
  TikTokCampaignOriginRow[]
> {
  assertModel()
  const rows = await prisma.tikTokCampaignOrigin.findMany()
  return rows.flatMap((row) => {
    const origin = parseOrigin(row.origin)
    if (!origin) return []
    return [{ campaignId: row.campaignId, origin }]
  })
}

export async function setTikTokCampaignOrigin(input: {
  campaignId: string
  origin: TikTokCampaignOriginValue | null
}): Promise<TikTokCampaignOriginRow | null> {
  assertModel()
  const campaignId = input.campaignId.trim()
  if (!campaignId) {
    throw new ServerActionError("Falta el id de la campaña.")
  }

  if (input.origin == null) {
    await prisma.tikTokCampaignOrigin.deleteMany({ where: { campaignId } })
    return null
  }

  if (!TIKTOK_CAMPAIGN_ORIGINS.includes(input.origin)) {
    throw new ServerActionError("Origen inválido.")
  }

  const row = await prisma.tikTokCampaignOrigin.upsert({
    where: { campaignId },
    create: { campaignId, origin: input.origin },
    update: { origin: input.origin },
  })

  return { campaignId: row.campaignId, origin: input.origin }
}
