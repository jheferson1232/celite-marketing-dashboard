import type { AdInsightRow } from "@/lib/services/meta/types"

export type BufferAdSelection = {
  bufferPostId: string
  videoId: string
  campaignIds: string[]
  adgroupIds: string[]
  updatedAt: string
}

export type BufferPostLinkOption = {
  id: string
  text: string
  videoId: string | null
  thumbnail: string | null
}

const STORAGE_KEY = "celite-buffer-ad-selection:v2"
const LEGACY_STORAGE_KEY = "celite-buffer-ad-selection:v1"
const CATALOG_KEY = "celite-buffer-posts-catalog:v1"

export function normalizeTikTokVideoId(
  itemIds: Array<string | null | undefined>
): string | null {
  for (const id of itemIds) {
    const trimmed = id?.trim() ?? ""
    if (!trimmed) continue
    const spark = trimmed.startsWith("spark:")
      ? trimmed.slice("spark:".length)
      : trimmed
    if (/^\d{8,}$/.test(spark)) return spark
  }
  return null
}

export function videoIdFromBufferExternalLink(
  externalLink: string | null | undefined
): string | null {
  const match = externalLink?.match(/\/video\/(\d{8,})/)?.[1]
  return match?.trim() || null
}

function readStore(): Record<string, BufferAdSelection> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, BufferAdSelection>
    if (!parsed || typeof parsed !== "object") return {}
    return parsed
  } catch {
    return {}
  }
}

function readLegacyStoreByVideoId(): Record<
  string,
  Omit<BufferAdSelection, "bufferPostId">
> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<
      string,
      Omit<BufferAdSelection, "bufferPostId">
    >
    if (!parsed || typeof parsed !== "object") return {}
    return parsed
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, BufferAdSelection>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Incógnito o cuota llena.
  }
}

export function mergeBufferPostLinkOptions(
  ...lists: BufferPostLinkOption[][]
): BufferPostLinkOption[] {
  const byId = new Map<string, BufferPostLinkOption>()
  for (const list of lists) {
    for (const post of list) {
      const existing = byId.get(post.id)
      if (!existing) {
        byId.set(post.id, post)
        continue
      }
      byId.set(post.id, {
        id: post.id,
        text: post.text || existing.text,
        videoId: post.videoId ?? existing.videoId,
        thumbnail: post.thumbnail ?? existing.thumbnail,
      })
    }
  }
  return [...byId.values()]
}

export function bufferPostLinkOptionsFromBoardPosts(
  posts: Array<{
    id: string
    text: string
    externalLink: string | null
    channelService: string
    assets: Array<{ thumbnail?: string | null }>
  }>
): BufferPostLinkOption[] {
  return posts.flatMap((post) => {
    if (post.channelService.toLowerCase() !== "tiktok") return []
    if (!post.id.trim()) return []
    const text = post.text.replace(/\s+/g, " ").trim()
    const thumbnail = thumbnailFromBufferAssets(post.assets)
    return [
      {
        id: post.id,
        text: text || "Post TikTok",
        videoId: videoIdFromBufferExternalLink(post.externalLink),
        thumbnail,
      },
    ]
  })
}

function thumbnailFromBufferAssets(
  assets: Array<{ thumbnail?: string | null }> | undefined
): string | null {
  return assets?.find((asset) => asset.thumbnail)?.thumbnail?.trim() || null
}

export function rememberBufferPostCatalog(
  posts: Array<{
    id: string
    text: string
    externalLink: string | null
    channelService: string
    assets?: Array<{ thumbnail?: string | null }>
  }>
) {
  if (typeof window === "undefined") return

  const slim: BufferPostLinkOption[] = posts.flatMap((post) => {
    if (post.channelService.toLowerCase() !== "tiktok") return []
    if (!post.id.trim()) return []
    const text = post.text.replace(/\s+/g, " ").trim()
    const thumbnail = thumbnailFromBufferAssets(post.assets)
    return [
      {
        id: post.id,
        text: text || "Post TikTok",
        videoId: videoIdFromBufferExternalLink(post.externalLink),
        thumbnail,
      },
    ]
  })

  if (slim.length === 0) return

  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(slim))
  } catch {
    // Incógnito o cuota llena.
  }
}

export function readBufferPostCatalog(): BufferPostLinkOption[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(CATALOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BufferPostLinkOption[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((post) => post.id)
      .map((post) => ({
        ...post,
        text: post.text || "Post TikTok",
        thumbnail: post.thumbnail ?? null,
      }))
  } catch {
    return []
  }
}

export function collectAdIdsFromInsightGroup(group: AdInsightRow[]): {
  campaignIds: string[]
  adgroupIds: string[]
} {
  const campaignIds = new Set<string>()
  const adgroupIds = new Set<string>()
  for (const row of group) {
    const campaignId = row.campaign_id?.trim()
    const adgroupId = row.adset_id?.trim()
    if (campaignId) campaignIds.add(campaignId)
    if (adgroupId) adgroupIds.add(adgroupId)
  }
  return {
    campaignIds: [...campaignIds],
    adgroupIds: [...adgroupIds],
  }
}

export function saveBufferAdSelection(input: {
  bufferPostId: string
  videoId: string
  campaignIds: string[]
  adgroupIds: string[]
}): BufferAdSelection {
  const bufferPostId = input.bufferPostId.trim()
  const videoId = input.videoId.trim()
  const selection: BufferAdSelection = {
    bufferPostId,
    videoId,
    campaignIds: [...new Set(input.campaignIds.map((id) => id.trim()).filter(Boolean))],
    adgroupIds: [...new Set(input.adgroupIds.map((id) => id.trim()).filter(Boolean))],
    updatedAt: new Date().toISOString(),
  }
  const store = readStore()
  store[bufferPostId] = selection
  writeStore(store)
  return selection
}

export function hasExplicitBufferAdSelectionForPost(
  bufferPostId: string | null | undefined
): boolean {
  const postId = bufferPostId?.trim()
  if (!postId) return false
  return Boolean(readStore()[postId])
}

export function readBufferAdSelectionForPost(
  bufferPostId: string | null | undefined,
  videoId: string | null | undefined
): BufferAdSelection | null {
  const postId = bufferPostId?.trim()
  if (postId) {
    const direct = readStore()[postId]
    if (direct) return direct
  }
  const legacyVideoId = videoId?.trim()
  if (!legacyVideoId) return null
  const legacy = readLegacyStoreByVideoId()[legacyVideoId]
  if (!legacy) return null
  return {
    bufferPostId: postId ?? "",
    ...legacy,
  }
}

/** Post de Buffer ya vinculado a este creativo (mismo video + campañas/conjuntos). */
export function findLinkedBufferPostId(
  videoId: string,
  group: AdInsightRow[]
): string | null {
  for (const [postId, selection] of Object.entries(readStore())) {
    if (selection.videoId !== videoId) continue
    if (bufferSelectionMatchesGroup(selection, group)) return postId
  }
  const legacy = readLegacyStoreByVideoId()[videoId]
  if (legacy && bufferSelectionMatchesGroup({ bufferPostId: "", ...legacy }, group)) {
    return null
  }
  return null
}

export function clearBufferAdSelectionLink(input: {
  bufferPostId: string | null
  videoId: string
  group: AdInsightRow[]
}): void {
  if (typeof window === "undefined") return

  const videoId = input.videoId.trim()
  const store = readStore()
  let storeChanged = false

  const explicitId = input.bufferPostId?.trim()
  if (explicitId && store[explicitId]) {
    delete store[explicitId]
    storeChanged = true
  }

  for (const [postId, selection] of Object.entries(store)) {
    if (selection.videoId !== videoId) continue
    if (!bufferSelectionMatchesGroup(selection, input.group)) continue
    delete store[postId]
    storeChanged = true
  }

  if (storeChanged) writeStore(store)

  const legacyStore = readLegacyStoreByVideoId()
  const legacy = legacyStore[videoId]
  if (
    legacy &&
    bufferSelectionMatchesGroup({ bufferPostId: "", ...legacy }, input.group)
  ) {
    delete legacyStore[videoId]
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyStore))
    } catch {
      // Incógnito o cuota llena.
    }
  }
}

/** Restringe la selección guardada a campañas/conjuntos presentes en los ads del video. */
export function filterSelectionToVideoAds<
  T extends { campaignId: string; adgroupId: string },
>(selection: BufferAdSelection, ads: T[]): {
  campaignIds: string[]
  adgroupIds: string[]
} {
  const adgroupIds = selection.adgroupIds.filter((id) =>
    ads.some((ad) => ad.adgroupId === id)
  )
  const campaignIds = new Set(
    selection.campaignIds.filter((id) => ads.some((ad) => ad.campaignId === id))
  )
  for (const ad of ads) {
    if (adgroupIds.includes(ad.adgroupId)) campaignIds.add(ad.campaignId)
  }
  return {
    campaignIds: [...campaignIds],
    adgroupIds,
  }
}

export function defaultSelectionForVideoAds<
  T extends { campaignId: string; adgroupId: string },
>(ads: T[]): { campaignIds: string[]; adgroupIds: string[] } {
  return {
    campaignIds: [...new Set(ads.map((ad) => ad.campaignId))],
    adgroupIds: [...new Set(ads.map((ad) => ad.adgroupId))],
  }
}

function sameIdSet(a: string[], b: string[]): boolean {
  const setA = new Set(a.map((x) => x.trim()).filter(Boolean))
  const setB = new Set(b.map((x) => x.trim()).filter(Boolean))
  if (setA.size !== setB.size) return false
  for (const value of setA) {
    if (!setB.has(value)) return false
  }
  return true
}

export function bufferSelectionMatchesGroup(
  selection: BufferAdSelection | null,
  group: AdInsightRow[]
): boolean {
  if (!selection) return false
  const { campaignIds, adgroupIds } = collectAdIdsFromInsightGroup(group)
  return (
    sameIdSet(selection.campaignIds, campaignIds) &&
    sameIdSet(selection.adgroupIds, adgroupIds)
  )
}
