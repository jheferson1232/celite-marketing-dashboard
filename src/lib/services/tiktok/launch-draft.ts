import type { NotionCampaignDraft } from "@/lib/services/notion/campaigns"
import type { ProductRecord } from "@/lib/services/product"

export type TikTokLaunchDraftSource = "notion" | "product"

export type TikTokLaunchDraft = {
  id: string
  name: string
  dailyBudget: number | null
  urls: string[]
  platform: string | null
  source: TikTokLaunchDraftSource
  /** Videos en Blob (solo productos). */
  blobVideoUrls?: string[]
}

function ensureHttps(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  return `https://${trimmed}`
}

export function collectProductLaunchUrls(product: ProductRecord): string[] {
  const seen = new Set<string>()
  const urls: string[] = []

  const add = (raw: string) => {
    const url = ensureHttps(raw)
    if (!url) return
    const key = url.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    urls.push(url)
  }

  for (const landingPage of product.landingPages) add(landingPage.url)
  for (const variant of product.variants) add(variant.url)

  return urls
}

export function notionDraftToLaunchDraft(
  draft: NotionCampaignDraft
): TikTokLaunchDraft {
  return {
    id: draft.pageId,
    name: draft.name,
    dailyBudget: draft.dailyBudget,
    urls: draft.urls,
    platform: draft.platform,
    source: "notion",
  }
}

export function productToLaunchDraft(product: ProductRecord): TikTokLaunchDraft {
  return {
    id: product.id,
    name: product.name,
    dailyBudget: product.budget > 0 ? product.budget : null,
    urls: collectProductLaunchUrls(product),
    platform: "TikTok",
    source: "product",
    blobVideoUrls: product.videos,
  }
}
