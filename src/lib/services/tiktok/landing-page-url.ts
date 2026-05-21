type TikTokUrlContext = {
  campaignId?: string
  campaignName?: string
  adId?: string
  adgroupId?: string
}

const UNRESOLVED_MACRO = /__\w+__/

/**
 * TikTok returns landing_page_url as a template with macros (e.g. __CAMPAIGN_ID__).
 * Those are substituted at click time in Ads Manager; we resolve them for display.
 */
export function resolveTikTokLandingPageUrl(
  template: string,
  ctx: TikTokUrlContext
): string {
  const raw = template.trim()
  if (!raw) return ""

  const campaignName = ctx.campaignName?.trim() ?? ""
  const encodedCampaignName = campaignName
    ? encodeURIComponent(campaignName)
    : ""

  let resolved = raw
    .replaceAll("__CAMPAIGN_ID__", ctx.campaignId ?? "")
    .replaceAll("__CAMPAIGN_NAME__", encodedCampaignName)
    .replaceAll("__AID__", ctx.adId ?? "")
    .replaceAll("__ADGROUP_ID__", ctx.adgroupId ?? "")
    .replaceAll("__CID__", ctx.adId ?? "")

  if (!UNRESOLVED_MACRO.test(resolved)) {
    return resolved
  }

  try {
    const url = new URL(resolved)
    for (const [key, value] of [...url.searchParams.entries()]) {
      if (UNRESOLVED_MACRO.test(value)) {
        url.searchParams.delete(key)
      }
    }
    resolved = url.toString()
  } catch {
    return UNRESOLVED_MACRO.test(resolved) ? "" : resolved
  }

  return UNRESOLVED_MACRO.test(resolved) ? "" : resolved
}

export function getTikTokLandingPageUrl(ad?: {
  landing_page_url?: string
  landing_page_urls?: string[]
}): string {
  const fromList = ad?.landing_page_urls?.find(Boolean)
  return ad?.landing_page_url?.trim() || fromList?.trim() || ""
}

/** Clave estable para deduplicar URLs (host + path, sin UTM ni barra final). */
export function normalizeLandingPageUrlKey(url: string): string {
  const raw = url.trim()
  if (!raw) return ""

  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase()
    let path = parsed.pathname || "/"
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1)
    }
    return `${host}${path}`
  } catch {
    const withoutQuery = raw.split("?")[0] ?? raw
    return withoutQuery.toLowerCase().replace(/\/$/, "")
  }
}
