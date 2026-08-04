/**
 * One-shot: vincula campañas TikTok de todas las cuentas a productos por nombre.
 * Uso: pnpm dlx tsx --env-file=.env --env-file=.env.local scripts/link-tiktok-campaigns-to-products.mjs
 */
import { PrismaClient } from "../src/app/generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"
import axios from "axios"

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("Falta DATABASE_URL")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function significantTokens(name: string): string[] {
  const stop = new Set([
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "y",
    "en",
    "00",
    "oferta",
    "test",
    "abo",
    "cbo",
  ])
  return normalize(name)
    .split(" ")
    .filter((t) => t.length >= 3 && !stop.has(t) && !/^\d{1,2}$/.test(t))
}

type ProductRow = { id: string; name: string; tokens: string[] }

function hasToken(haystack: string, token: string): boolean {
  const parts = haystack.split(" ")
  return parts.includes(token)
}

function scoreCampaignToProduct(
  campaignName: string,
  product: ProductRow
): number {
  const campaignNorm = normalize(campaignName)
  if (!campaignNorm || product.tokens.length === 0) return 0

  const productNorm = normalize(product.name)
  if (campaignNorm.includes(productNorm) && productNorm.length >= 4) {
    return 1000 + productNorm.length
  }

  let matched = 0
  let matchedChars = 0
  for (const token of product.tokens) {
    if (hasToken(campaignNorm, token)) {
      matched += 1
      matchedChars += token.length
    }
  }
  if (matched === 0) return 0

  const fullBonus = matched === product.tokens.length ? 100 : 0
  return matched * 20 + matchedChars + fullBonus
}

async function listCampaignsForAccount(input: {
  advertiserId: string
  accessToken: string
}): Promise<Array<{ id: string; name: string }>> {
  const client = axios.create({
    baseURL: "https://business-api.tiktok.com/open_api/v1.3",
    headers: { "Access-Token": input.accessToken },
  })

  const campaigns: Array<{ id: string; name: string }> = []
  let page = 1
  let totalPage = 1

  while (page <= totalPage) {
    const { data } = await client.get("/campaign/get/", {
      params: {
        advertiser_id: input.advertiserId,
        page,
        page_size: 100,
        fields: JSON.stringify(["campaign_id", "campaign_name", "operation_status"]),
      },
    })
    if (data.code !== 0) {
      throw new Error(data.message || JSON.stringify(data))
    }
    const list = data.data?.list ?? []
    for (const row of list) {
      const id = String(row.campaign_id ?? "").trim()
      const name = String(row.campaign_name ?? "").trim()
      if (!id) continue
      campaigns.push({ id, name: name || id })
    }
    totalPage = Number(data.data?.page_info?.total_page || 1)
    page += 1
    if (page > 30) break
  }

  return campaigns
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const productsRaw = await prisma.product.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  const products: ProductRow[] = productsRaw
    .map((p) => ({
      id: p.id,
      name: p.name,
      tokens: significantTokens(p.name),
    }))
    .filter((p) => p.tokens.length > 0)
    // Preferir nombres más largos al empatar
    .toSorted((a, b) => b.tokens.join("").length - a.tokens.join("").length)

  console.log(`Productos: ${products.length}`)

  const existing = await prisma.productCampaign.findMany({
    where: { platform: "tiktok" },
    select: { campaignId: true, productId: true },
  })
  const linkedCampaignIds = new Set(existing.map((e) => e.campaignId))
  console.log(`Ya vinculadas TikTok: ${linkedCampaignIds.size}`)

  const accounts = await prisma.tikTokAdAccount.findMany({
    where: { status: "active" },
    select: {
      id: true,
      name: true,
      advertiserId: true,
      accessToken: true,
    },
    orderBy: { connectedAt: "desc" },
  })
  console.log(`Cuentas TikTok activas: ${accounts.length}`)

  let linked = 0
  let skippedLinked = 0
  let unmatched = 0
  const linkedExamples: string[] = []

  for (const account of accounts) {
    if (!account.accessToken) {
      console.warn(`Sin token: ${account.name}`)
      continue
    }

    let campaigns: Array<{ id: string; name: string }> = []
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        campaigns = await listCampaignsForAccount({
          advertiserId: account.advertiserId,
          accessToken: account.accessToken,
        })
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (message.toLowerCase().includes("qps") && attempt < 3) {
          await sleep(600 * (attempt + 1))
          continue
        }
        console.error(`FAIL ${account.name}:`, message)
        campaigns = []
        break
      }
    }

    console.log(`\n${account.name}: ${campaigns.length} campañas`)

    for (const campaign of campaigns) {
      if (linkedCampaignIds.has(campaign.id)) {
        skippedLinked += 1
        continue
      }

      let best: ProductRow | null = null
      let bestScore = 0
      let secondScore = 0
      for (const product of products) {
        const score = scoreCampaignToProduct(campaign.name, product)
        if (score > bestScore) {
          secondScore = bestScore
          bestScore = score
          best = product
        } else if (score > secondScore) {
          secondScore = score
        }
      }

      // Evitar empates ambiguos (p. ej. "big" en varios productos)
      if (!best || bestScore < 20 || bestScore === secondScore) {
        unmatched += 1
        continue
      }

      await prisma.productCampaign.upsert({
        where: {
          productId_campaignId_platform: {
            productId: best.id,
            campaignId: campaign.id,
            platform: "tiktok",
          },
        },
        create: {
          productId: best.id,
          campaignId: campaign.id,
          campaignName: campaign.name,
          platform: "tiktok",
        },
        update: {
          campaignName: campaign.name,
        },
      })

      linkedCampaignIds.add(campaign.id)
      linked += 1
      if (linkedExamples.length < 40) {
        linkedExamples.push(
          `${account.name} · ${campaign.name} → ${best.name} (score ${bestScore})`
        )
      }
    }

    await sleep(250)
  }

  console.log("\n=== Resultado ===")
  console.log({ linked, skippedLinked, unmatched })
  console.log("Ejemplos:")
  for (const line of linkedExamples) console.log(" -", line)

  const tag = await prisma.product.findFirst({
    where: { name: { contains: "Tag Skate", mode: "insensitive" } },
    include: { campaigns: { where: { platform: "tiktok" } } },
  })
  if (tag) {
    console.log(`\nTag Skate TikTok vinculadas: ${tag.campaigns.length}`)
    console.log(
      tag.campaigns.map((c) => c.campaignName || c.campaignId).join("\n")
    )
  }

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
