import crypto from "crypto"
import fs from "fs"
import { mapWithConcurrency } from "./concurrency"
import { fetchAllPages } from "./fetch-all-pages"
import {
  fetchWithRetry,
  postTikTokMultipartWithRetry,
} from "./fetch-with-retry"
import type { LaunchMetrics } from "./launch-metrics"
import {
  launchProgressMessage,
  setLaunchProgress,
} from "./launch-progress"
import type {
  TikTokLaunchCampaignConfig,
  TikTokLaunchResult,
} from "./launch-campaign-types"
import {
  getTikTokRequestContext,
} from "./tiktok-api.server"
import { resolveTikTokCredentials } from "./tiktok-credentials.server"
import { clearTikTokCache } from "./tiktok-cache"
import { pacedTikTokRequest } from "./tiktok-request-pacing"
import type { TikTokCampaign } from "./types"

const BASE_URL = "https://business-api.tiktok.com/open_api/v1.3"
const ASSET_CONCURRENCY = 3
const COVER_POLL_ATTEMPTS = 6
const COVER_POLL_DELAY_MS = 3_000

type LaunchOptions = {
  /** ID interno de campaña (para progreso en UI). */
  progressCampaignId?: string
  metrics?: LaunchMetrics
}

type LaunchContext = {
  cfg: TikTokLaunchCampaignConfig
  metrics?: LaunchMetrics
  progressCampaignId?: string
  videoBySignature: Map<string, string>
  imageBySignature: Map<string, string>
  videoIdByPath: Map<string, string>
  imageIdByVideoId: Map<string, string>
  imageLibraryLoaded: boolean
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getIdentityId(
  cfg: TikTokLaunchCampaignConfig,
  identityId: string | null
): string {
  return (
    cfg.campaign.identity_id ??
    identityId?.trim() ??
    process.env.TIKTOK_IDENTITY_ID?.trim() ??
    "1e66c1ac-4cf3-5052-85d8-ff750ffe808f"
  )
}

async function getAccessToken(): Promise<string> {
  const { accessToken } = await resolveTikTokCredentials()
  return accessToken
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

function updateProgress(
  ctx: LaunchContext,
  stage: Parameters<typeof setLaunchProgress>[1]["stage"],
  current: number,
  total: number
): void {
  if (!ctx.progressCampaignId) return
  setLaunchProgress(ctx.progressCampaignId, {
    stage,
    current,
    total,
    message: launchProgressMessage(stage, current, total),
  })
}

async function tiktokPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return pacedTikTokRequest(async () => {
    const { client } = await getTikTokRequestContext()
    const { data } = await client.post<{ data: T }>(path, body)
    return data.data
  })
}

async function tiktokGet<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  return pacedTikTokRequest(async () => {
    const { client, advertiserId } = await getTikTokRequestContext()
    const { data } = await client.get<{ data: T }>(path, {
      params: { advertiser_id: advertiserId, ...params },
    })
    return data.data
  })
}

function computeFileMd5(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  return crypto.createHash("md5").update(buf).digest("hex")
}

async function prefetchVideoLibrary(
  ctx: LaunchContext,
  signatures: string[]
): Promise<void> {
  if (signatures.length === 0) return

  const missing = signatures.filter((sig) => !ctx.videoBySignature.has(sig))
  if (missing.length === 0) return

  const data = await tiktokGet<{
    list?: { signature: string; video_id: string }[]
  }>("/file/video/ad/search/", {
    fields: '["video_id","signature","file_name"]',
    page_size: "100",
  })

  for (const video of data?.list ?? []) {
    if (missing.includes(video.signature)) {
      ctx.videoBySignature.set(video.signature, video.video_id)
      if (ctx.metrics) ctx.metrics.counters.libraryPrefetchHits += 1
    }
  }
}

async function ensureImageLibrary(ctx: LaunchContext): Promise<void> {
  if (ctx.imageLibraryLoaded) return

  const data = await tiktokGet<{
    list?: { image_id: string; signature: string }[]
  }>("/file/image/ad/search/", {
    fields: '["image_id","signature"]',
    page_size: "100",
  })

  for (const image of data?.list ?? []) {
    ctx.imageBySignature.set(image.signature, image.image_id)
  }
  ctx.imageLibraryLoaded = true
}

async function uploadVideo(filePath: string, ctx: LaunchContext): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Video no encontrado: ${filePath}`)
  }

  const cachedByPath = ctx.videoIdByPath.get(filePath)
  if (cachedByPath) {
    if (ctx.metrics) ctx.metrics.counters.videoCacheHits += 1
    return cachedByPath
  }

  const md5 = computeFileMd5(filePath)
  const existing = ctx.videoBySignature.get(md5)
  if (existing) {
    ctx.videoIdByPath.set(filePath, existing)
    if (ctx.metrics) ctx.metrics.counters.videoCacheHits += 1
    return existing
  }

  const name = filePath.split(/[/\\]/).pop() ?? "video.mp4"
  const buf = fs.readFileSync(filePath)
  const token = await getAccessToken()
  const { advertiserId } = await getTikTokRequestContext()
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

  const json = await postTikTokMultipartWithRetry<{
    code: number
    message: string
    data: { video_id: string } | { video_id: string }[]
  }>(`${BASE_URL}/file/video/ad/upload/`, fd, token, {
    label: `upload video ${name}`,
  })

  const arr = Array.isArray(json.data) ? json.data : [json.data]
  const videoId = arr[0]?.video_id
  if (!videoId) throw new Error(`upload video ${name}: sin video_id`)

  ctx.videoBySignature.set(md5, videoId)
  ctx.videoIdByPath.set(filePath, videoId)
  return videoId
}

async function uploadCover(videoId: string, ctx: LaunchContext): Promise<string> {
  const cachedCover = ctx.imageIdByVideoId.get(videoId)
  if (cachedCover) {
    if (ctx.metrics) ctx.metrics.counters.coverCacheHits += 1
    return cachedCover
  }

  let coverUrl: string | null = null
  for (let attempt = 0; attempt < COVER_POLL_ATTEMPTS; attempt++) {
    if (ctx.metrics) ctx.metrics.counters.coverPollAttempts += 1

    const data = await tiktokGet<{
      list?: { video_cover_url?: string }[]
    }>("/file/video/ad/search/", {
      filtering: JSON.stringify({ video_ids: [videoId] }),
      fields: '["video_id","video_cover_url"]',
      page_size: "10",
    })
    coverUrl = data?.list?.[0]?.video_cover_url ?? null
    if (coverUrl) break
    if (attempt < COVER_POLL_ATTEMPTS - 1) {
      await sleep(COVER_POLL_DELAY_MS)
    }
  }
  if (!coverUrl) throw new Error(`No cover URL for video ${videoId}`)

  const imgRes = await fetchWithRetry(coverUrl, {}, {
    label: `descarga cover ${videoId}`,
    timeoutMs: 60_000,
  })
  const imgBuf = Buffer.from(await imgRes.arrayBuffer())
  const md5 = crypto.createHash("md5").update(imgBuf).digest("hex")

  await ensureImageLibrary(ctx)
  const existing = ctx.imageBySignature.get(md5)
  if (existing) {
    ctx.imageIdByVideoId.set(videoId, existing)
    if (ctx.metrics) ctx.metrics.counters.coverCacheHits += 1
    return existing
  }

  const token = await getAccessToken()
  const { advertiserId } = await getTikTokRequestContext()
  const fd = new FormData()
  fd.append("advertiser_id", advertiserId)
  fd.append("upload_type", "UPLOAD_BY_FILE")
  fd.append(
    "image_file",
    new Blob([imgBuf], { type: "image/jpeg" }),
    `cover_${videoId}.jpg`
  )
  fd.append("image_signature", md5)

  const json = await postTikTokMultipartWithRetry<{
    code: number
    message: string
    data?: { image_id: string }
  }>(`${BASE_URL}/file/image/ad/upload/`, fd, token, {
    label: `upload cover ${videoId}`,
  })

  if (!json.data?.image_id) throw new Error("upload cover: sin image_id")

  ctx.imageBySignature.set(md5, json.data.image_id)
  ctx.imageIdByVideoId.set(videoId, json.data.image_id)
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

  const { advertiserId } = await getTikTokRequestContext()
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

async function resolveVideoIdForAdgroup(
  ag: TikTokLaunchCampaignConfig["adgroups"][number],
  ctx: LaunchContext
): Promise<string> {
  if (ag.video_id) return ag.video_id
  if (!ag.video) {
    throw new Error(`Conjunto "${ag.name}": falta video o video_id`)
  }
  return uploadVideo(ag.video, ctx)
}

async function resolveCoverIdForVideo(
  videoId: string,
  ctx: LaunchContext
): Promise<string> {
  return uploadCover(videoId, ctx)
}

async function createAdgroupAndAd(
  cfg: TikTokLaunchCampaignConfig,
  campaignId: string,
  ag: TikTokLaunchCampaignConfig["adgroups"][number],
  index: number,
  videoId: string,
  imageId: string,
  startTime: string,
  api: { advertiserId: string; identityId: string | null }
): Promise<TikTokLaunchResult["adGroups"][number]> {
  const { advertiserId, identityId } = api
  const CTAS = cfg.ctas ?? ["SHOP_NOW", "ORDER_NOW", "LEARN_MORE"]
  const cta = CTAS[index % CTAS.length]!
  const landingUrl = buildUrl(
    ag.url ?? cfg.campaign.default_url ?? "",
    cfg.campaign.utm
  )

  const optimizationEvent =
    cfg.campaign.optimization_event === "COMPLETE_PAYMENT" ||
    !cfg.campaign.optimization_event
      ? "SHOPPING"
      : cfg.campaign.optimization_event

  const agData = await tiktokPost<{ adgroup_id: string }>("/adgroup/create/", {
    advertiser_id: advertiserId,
    campaign_id: campaignId,
    adgroup_name: ag.name,
    objective_type: cfg.campaign.objective ?? "WEB_CONVERSIONS",
    promotion_type: "WEBSITE",
    landing_page_url: landingUrl,
    pixel_id: cfg.campaign.pixel_id,
    optimization_event: optimizationEvent,
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

  const adData = await tiktokPost<{ ad_ids?: string[] }>("/ad/create/", {
    advertiser_id: advertiserId,
    adgroup_id: agData.adgroup_id,
    creatives: [
      {
        ad_name: ag.name,
        ad_format: "SINGLE_VIDEO",
        identity_type: "TT_USER",
        identity_id: getIdentityId(cfg, identityId),
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

  return {
    name: ag.name,
    adgroup_id: agData.adgroup_id,
    ad_id: adData.ad_ids?.[0],
    cta,
    url: landingUrl,
  }
}

export async function launchTikTokCampaign(
  cfg: TikTokLaunchCampaignConfig,
  options: LaunchOptions = {}
): Promise<TikTokLaunchResult> {
  const { advertiserId, identityId } = await getTikTokRequestContext()
  const launchApi = { advertiserId, identityId }

  const ctx: LaunchContext = {
    cfg,
    metrics: options.metrics,
    progressCampaignId: options.progressCampaignId,
    videoBySignature: new Map(),
    imageBySignature: new Map(),
    videoIdByPath: new Map(),
    imageIdByVideoId: new Map(),
    imageLibraryLoaded: false,
  }

  const totalAdgroups = cfg.adgroups.length
  if (options.metrics) {
    options.metrics.counters.adgroupsTotal = totalAdgroups
  }

  const campaignName = cfg.campaign.name
  const objective = cfg.campaign.objective ?? "WEB_CONVERSIONS"

  updateProgress(ctx, "resolve_campaign", 0, totalAdgroups)

  const resolveCampaign = async () =>
    resolveCampaignId(campaignName, cfg.campaign.campaign_id, objective)

  const { campaignId, reusedExisting } = options.metrics
    ? await options.metrics.time("resolve_campaign", resolveCampaign)
    : await resolveCampaign()

  const startTime = new Date().toISOString().replace("T", " ").slice(0, 19)

  const signaturesToPrefetch = cfg.adgroups
    .filter((ag) => ag.video && !ag.video_id && fs.existsSync(ag.video))
    .map((ag) => computeFileMd5(ag.video!))

  const prefetchLibrary = async () => prefetchVideoLibrary(ctx, signaturesToPrefetch)
  if (options.metrics) {
    await options.metrics.time("prefetch_library", prefetchLibrary)
  } else {
    await prefetchLibrary()
  }

  updateProgress(ctx, "resolve_videos", 0, totalAdgroups)

  const resolveVideos = async () =>
    mapWithConcurrency(cfg.adgroups, ASSET_CONCURRENCY, async (ag, index) => {
      updateProgress(ctx, "resolve_videos", index + 1, totalAdgroups)
      return resolveVideoIdForAdgroup(ag, ctx)
    })

  const videoIds = options.metrics
    ? await options.metrics.time("resolve_videos", resolveVideos)
    : await resolveVideos()

  updateProgress(ctx, "resolve_covers", 0, totalAdgroups)

  const resolveCovers = async () =>
    mapWithConcurrency(videoIds, ASSET_CONCURRENCY, async (videoId, index) => {
      updateProgress(ctx, "resolve_covers", index + 1, totalAdgroups)
      return resolveCoverIdForVideo(videoId, ctx)
    })

  const imageIds = options.metrics
    ? await options.metrics.time("resolve_covers", resolveCovers)
    : await resolveCovers()

  const results: TikTokLaunchResult["adGroups"] = []

  const createAdgroups = async () => {
    for (let i = 0; i < cfg.adgroups.length; i++) {
      updateProgress(ctx, "create_adgroups", i + 1, totalAdgroups)
      const result = await createAdgroupAndAd(
        cfg,
        campaignId,
        cfg.adgroups[i]!,
        i,
        videoIds[i]!,
        imageIds[i]!,
        startTime,
        launchApi
      )
      results.push(result)
    }
  }

  if (options.metrics) {
    await options.metrics.time("create_adgroups", createAdgroups)
  } else {
    await createAdgroups()
  }

  const shouldLaunch = cfg.campaign.launch !== false

  if (shouldLaunch) {
    updateProgress(ctx, "enable_campaign", totalAdgroups, totalAdgroups)

    const enableCampaign = async () => {
      await tiktokPost("/campaign/status/update/", {
        advertiser_id: launchApi.advertiserId,
        campaign_ids: [campaignId],
        operation_status: "ENABLE",
      })

      const agIds = results.map((r) => r.adgroup_id)
      const adIds = results.map((r) => r.ad_id).filter(Boolean) as string[]

      await Promise.all([
        ...Array.from({ length: Math.ceil(agIds.length / 20) }, (_, batchIndex) => {
          const start = batchIndex * 20
          return tiktokPost("/adgroup/status/update/", {
            advertiser_id: launchApi.advertiserId,
            adgroup_ids: agIds.slice(start, start + 20),
            operation_status: "ENABLE",
          })
        }),
        ...Array.from({ length: Math.ceil(adIds.length / 20) }, (_, batchIndex) => {
          const start = batchIndex * 20
          return tiktokPost("/ad/status/update/", {
            advertiser_id: launchApi.advertiserId,
            ad_ids: adIds.slice(start, start + 20),
            operation_status: "ENABLE",
          })
        }),
      ])
    }

    if (options.metrics) {
      await options.metrics.time("enable_campaign", enableCampaign)
    } else {
      await enableCampaign()
    }
  }

  clearTikTokCache()

  if (ctx.progressCampaignId) {
    setLaunchProgress(ctx.progressCampaignId, {
      stage: "done",
      current: totalAdgroups,
      total: totalAdgroups,
      message: launchProgressMessage("done", totalAdgroups, totalAdgroups),
    })
  }

  return {
    campaignName,
    campaignId,
    adGroupCount: results.length,
    active: shouldLaunch,
    reusedExistingCampaign: reusedExisting,
    adGroups: results,
  }
}
