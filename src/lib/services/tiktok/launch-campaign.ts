import crypto from "crypto"
import fs from "fs"
import { fetchAllPages } from "./fetch-all-pages"
import { getTikTokAdvertiserId, getTikTokClient } from "./tiktok"
import { clearTikTokCache } from "./tiktok-cache"
import type { TikTokCampaign } from "./types"
import type {
  TikTokLaunchCampaignConfig,
  TikTokLaunchResult,
} from "./launch-campaign-types"

const BASE_URL = "https://business-api.tiktok.com/open_api/v1.3"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getIdentityId(cfg: TikTokLaunchCampaignConfig): string {
  return (
    cfg.campaign.identity_id ??
    process.env.TIKTOK_IDENTITY_ID?.trim() ??
    "1e66c1ac-4cf3-5052-85d8-ff750ffe808f"
  )
}

function getAccessToken(): string {
  const token = process.env.TIKTOK_ACCESS_TOKEN?.trim()
  if (!token) throw new Error("TIKTOK_ACCESS_TOKEN no está configurado")
  return token
}

function buildUrl(
  baseUrl: string,
  utmParams?: Record<string, string>
): string {
  if (!utmParams || Object.keys(utmParams).length === 0) return baseUrl
  const qs = Object.entries(utmParams)
    .map(([k, v]) => `${k}=${v}`)
    .join("&")
  return `${baseUrl}?${qs}`
}

async function tiktokPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const client = getTikTokClient()
  const { data } = await client.post<{ data: T }>(path, body)
  return data.data
}

async function tiktokGet<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const client = getTikTokClient()
  const advertiserId = getTikTokAdvertiserId()
  const { data } = await client.get<{ data: T }>(path, {
    params: { advertiser_id: advertiserId, ...params },
  })
  return data.data
}

async function getLibraryBySignatures(
  sigs: string[]
): Promise<Record<string, string>> {
  const data = await tiktokGet<{
    list?: { signature: string; video_id: string }[]
  }>("/file/video/ad/search/", {
    fields: '["video_id","signature","file_name"]',
    page_size: "100",
  })
  const map: Record<string, string> = {}
  for (const v of data?.list ?? []) {
    if (sigs.includes(v.signature)) map[v.signature] = v.video_id
  }
  return map
}

async function uploadVideo(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Video no encontrado: ${filePath}`)
  }

  const buf = fs.readFileSync(filePath)
  const md5 = crypto.createHash("md5").update(buf).digest("hex")
  const name = filePath.split(/[/\\]/).pop() ?? "video.mp4"

  const existing = await getLibraryBySignatures([md5])
  if (existing[md5]) return existing[md5]

  const token = getAccessToken()
  const advertiserId = getTikTokAdvertiserId()
  const fd = new FormData()
  fd.append("advertiser_id", advertiserId)
  fd.append("upload_type", "UPLOAD_BY_FILE")
  fd.append(
    "video_file",
    new Blob([buf], { type: "video/mp4" }),
    `${Date.now()}_${name}`
  )
  fd.append("video_signature", md5)
  fd.append("flaw_detect", "true")

  const res = await fetch(`${BASE_URL}/file/video/ad/upload/`, {
    method: "POST",
    headers: { "Access-Token": token },
    body: fd,
  })
  const json = (await res.json()) as {
    code: number
    message: string
    data: { video_id: string } | { video_id: string }[]
  }
  if (json.code !== 0) {
    throw new Error(`upload video ${name}: ${json.code} — ${json.message}`)
  }
  const arr = Array.isArray(json.data) ? json.data : [json.data]
  const videoId = arr[0]?.video_id
  if (!videoId) throw new Error(`upload video ${name}: sin video_id`)
  return videoId
}

async function uploadCover(videoId: string): Promise<string> {
  let coverUrl: string | null = null
  for (let attempt = 0; attempt < 6; attempt++) {
    const data = await tiktokGet<{
      list?: { video_cover_url?: string }[]
    }>("/file/video/ad/search/", {
      filtering: JSON.stringify({ video_ids: [videoId] }),
      fields: '["video_id","video_cover_url"]',
      page_size: "10",
    })
    coverUrl = data?.list?.[0]?.video_cover_url ?? null
    if (coverUrl) break
    await sleep(3000)
  }
  if (!coverUrl) throw new Error(`No cover URL for video ${videoId}`)

  const imgBuf = Buffer.from(await (await fetch(coverUrl)).arrayBuffer())
  const md5 = crypto.createHash("md5").update(imgBuf).digest("hex")
  const token = getAccessToken()
  const advertiserId = getTikTokAdvertiserId()

  const existing = await tiktokGet<{
    list?: { image_id: string; signature: string }[]
  }>("/file/image/ad/search/", {
    fields: '["image_id","signature"]',
    page_size: "100",
  })
  const found = (existing?.list ?? []).find((img) => img.signature === md5)
  if (found) return found.image_id

  const fd = new FormData()
  fd.append("advertiser_id", advertiserId)
  fd.append("upload_type", "UPLOAD_BY_FILE")
  fd.append(
    "image_file",
    new Blob([imgBuf], { type: "image/jpeg" }),
    `cover_${videoId}.jpg`
  )
  fd.append("image_signature", md5)

  const res = await fetch(`${BASE_URL}/file/image/ad/upload/`, {
    method: "POST",
    headers: { "Access-Token": token },
    body: fd,
  })
  const json = (await res.json()) as {
    code: number
    message: string
    data?: { image_id: string }
  }
  if (json.code !== 0) {
    throw new Error(`upload cover: ${json.code} — ${json.message}`)
  }
  if (!json.data?.image_id) throw new Error("upload cover: sin image_id")
  return json.data.image_id
}

function normalizeCampaignName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

async function findCampaignIdByName(
  campaignName: string
): Promise<string | null> {
  const target = normalizeCampaignName(campaignName)
  const campaigns = await fetchAllPages<TikTokCampaign>("campaign/get/")
  const found = campaigns.find(
    (c) => normalizeCampaignName(c.campaign_name ?? "") === target
  )
  return found?.campaign_id ?? null
}

async function resolveCampaignId(
  campaignName: string,
  configuredId: string | null | undefined,
  objective: string
): Promise<{ campaignId: string; reusedExisting: boolean }> {
  if (configuredId) {
    return { campaignId: configuredId, reusedExisting: true }
  }

  const existing = await findCampaignIdByName(campaignName)
  if (existing) {
    return { campaignId: existing, reusedExisting: true }
  }

  const advertiserId = getTikTokAdvertiserId()
  const campaignData = await tiktokPost<{ campaign_id: string }>(
    "/campaign/create/",
    {
      advertiser_id: advertiserId,
      campaign_name: campaignName,
      objective_type: objective,
      campaign_type: "REGULAR_CAMPAIGN",
      budget_mode: "BUDGET_MODE_INFINITE",
      operation_status: "DISABLE",
    }
  )
  return { campaignId: campaignData.campaign_id, reusedExisting: false }
}

export async function launchTikTokCampaign(
  cfg: TikTokLaunchCampaignConfig
): Promise<TikTokLaunchResult> {
  const advertiserId = getTikTokAdvertiserId()
  const campaignName = cfg.campaign.name
  const objective = cfg.campaign.objective ?? "WEB_CONVERSIONS"

  const { campaignId, reusedExisting } = await resolveCampaignId(
    campaignName,
    cfg.campaign.campaign_id,
    objective
  )
  await sleep(reusedExisting ? 100 : 400)

  const startTime = new Date().toISOString().replace("T", " ").slice(0, 19)
  const CTAS = cfg.ctas ?? ["SHOP_NOW", "ORDER_NOW", "LEARN_MORE"]
  const results: TikTokLaunchResult["adGroups"] = []

  for (let i = 0; i < cfg.adgroups.length; i++) {
    const ag = cfg.adgroups[i]!
    const cta = CTAS[i % CTAS.length]!
    const landingUrl = buildUrl(
      ag.url ?? cfg.campaign.default_url ?? "",
      cfg.campaign.utm
    )

    const videoId = ag.video_id ?? (ag.video ? await uploadVideo(ag.video) : null)
    if (!videoId) {
      throw new Error(`Conjunto "${ag.name}": falta video o video_id`)
    }
    await sleep(300)

    const imageId = await uploadCover(videoId)
    await sleep(300)

    const agData = await tiktokPost<{ adgroup_id: string }>("/adgroup/create/", {
      advertiser_id: advertiserId,
      campaign_id: campaignId,
      adgroup_name: ag.name,
      objective_type: cfg.campaign.objective ?? "WEB_CONVERSIONS",
      promotion_type: "WEBSITE",
      landing_page_url: landingUrl,
      pixel_id: cfg.campaign.pixel_id,
      optimization_event: cfg.campaign.optimization_event ?? "ON_WEB_ORDER",
      optimization_goal: "CONVERT",
      billing_event: "OCPM",
      placements: ["PLACEMENT_TIKTOK"],
      placement_type: "PLACEMENT_TYPE_NORMAL",
      comment_disabled: true,
      video_download_disabled: true,
      video_share_disabled: true,
      budget_mode: "BUDGET_MODE_DAY",
      budget: cfg.campaign.daily_budget,
      schedule_type: "SCHEDULE_FROM_NOW",
      schedule_start_time: startTime,
      operation_status: "DISABLE",
      gender: cfg.campaign.gender ?? "GENDER_UNLIMITED",
      age_groups: cfg.campaign.age_groups ?? [
        "AGE_18_24",
        "AGE_25_34",
        "AGE_35_44",
        "AGE_45_54",
        "AGE_55_100",
      ],
      location_ids: cfg.campaign.location_ids ?? ["3686110"],
      bid_type: "BID_TYPE_NO_BID",
      pacing: "PACING_MODE_SMOOTH",
    })
    await sleep(300)

    const adData = await tiktokPost<{ ad_ids?: string[] }>("/ad/create/", {
      advertiser_id: advertiserId,
      adgroup_id: agData.adgroup_id,
      creatives: [
        {
          ad_name: ag.name,
          ad_format: "SINGLE_VIDEO",
          identity_type: "TT_USER",
          identity_id: getIdentityId(cfg),
          video_id: videoId,
          image_ids: [imageId],
          ad_text: cfg.campaign.ad_text ?? "",
          call_to_action: cta,
          landing_page_url: landingUrl,
          display_name: cfg.campaign.display_name ?? "jhefersonet",
          operation_status: "DISABLE",
        },
      ],
    })

    results.push({
      name: ag.name,
      adgroup_id: agData.adgroup_id,
      ad_id: adData.ad_ids?.[0],
      cta,
      url: landingUrl,
    })
    await sleep(400)
  }

  const shouldLaunch = cfg.campaign.launch !== false

  if (shouldLaunch) {
    await tiktokPost("/campaign/status/update/", {
      advertiser_id: advertiserId,
      campaign_ids: [campaignId],
      operation_status: "ENABLE",
    })
    const agIds = results.map((r) => r.adgroup_id)
    for (let i = 0; i < agIds.length; i += 20) {
      await tiktokPost("/adgroup/status/update/", {
        advertiser_id: advertiserId,
        adgroup_ids: agIds.slice(i, i + 20),
        operation_status: "ENABLE",
      })
    }
    const adIds = results.map((r) => r.ad_id).filter(Boolean) as string[]
    for (let i = 0; i < adIds.length; i += 20) {
      await tiktokPost("/ad/status/update/", {
        advertiser_id: advertiserId,
        ad_ids: adIds.slice(i, i + 20),
        operation_status: "ENABLE",
      })
    }
  }

  clearTikTokCache()

  return {
    campaignName,
    campaignId,
    adGroupCount: results.length,
    active: shouldLaunch,
    reusedExistingCampaign: reusedExisting,
    adGroups: results,
  }
}
