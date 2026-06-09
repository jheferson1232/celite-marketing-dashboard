import axios from "axios"
import { getSociaVaultClient } from "./sociavault-client"
import {
  asRecord,
  pickString,
  valuesFromListOrMap,
} from "./sociavault-parse-utils"

export type FacebookAdLibraryCompany = {
  pageId: string
  name: string
  imageUrl: string | null
  category: string | null
  likes: number | null
}

export type FacebookAdFormat = "video" | "image" | "dco" | "other"

export type FacebookAdLibraryAd = {
  adArchiveId: string
  pageId: string | null
  title: string | null
  body: string | null
  imageUrl: string | null
  videoPreviewUrl: string | null
  videoUrl: string | null
  isActive: boolean
  linkUrl: string | null
  pageName: string | null
  pageImageUrl: string | null
  startDate: string | null
  endDate: string | null
  format: FacebookAdFormat
  collationCount: number | null
  ctaText: string | null
  publisherPlatforms: string[]
}

export type FacebookCompanyAdsResult = {
  company: FacebookAdLibraryCompany | null
  ads: FacebookAdLibraryAd[]
  activeCount: number
  totalCount: number
  warning: string | null
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim()) {
      const n = Number(value)
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function parseCompanyRow(row: Record<string, unknown>): FacebookAdLibraryCompany | null {
  const pageId = pickString(row.page_id)
  const name = pickString(row.name)
  if (!pageId || !name) return null

  return {
    pageId,
    name,
    imageUrl: pickString(row.image_uri, row.page_profile_picture_url),
    category: pickString(row.category),
    likes: pickNumber(row.likes),
  }
}

function inferAdFormat(
  snapshot: Record<string, unknown> | null,
  firstCard: Record<string, unknown> | null,
  cardCount: number
): FacebookAdFormat {
  if (cardCount > 1) return "dco"
  const displayFormat = pickString(snapshot?.display_format)?.toUpperCase()
  if (displayFormat?.includes("VIDEO")) return "video"
  if (displayFormat?.includes("IMAGE")) return "image"
  if (
    pickString(
      firstCard?.video_sd_url,
      firstCard?.video_hd_url,
      firstCard?.watermarked_video_sd_url
    )
  ) {
    return "video"
  }
  if (pickString(firstCard?.original_image_url, firstCard?.resized_image_url)) {
    return "image"
  }
  return "other"
}

function parsePublisherPlatforms(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function extractCreativeFromSnapshot(snapshot: Record<string, unknown> | null): {
  imageUrl: string | null
  videoPreviewUrl: string | null
  videoUrl: string | null
  title: string | null
} {
  if (!snapshot) {
    return {
      imageUrl: null,
      videoPreviewUrl: null,
      videoUrl: null,
      title: null,
    }
  }

  const cards = valuesFromListOrMap(snapshot.cards)
  let title = pickString(snapshot.title)

  for (const card of cards) {
    const row = asRecord(card)
    if (!row) continue

    title = title ?? pickString(row.title)
    const videoPreviewUrl = pickString(row.video_preview_image_url)
    const videoUrl = pickString(
      row.video_sd_url,
      row.video_hd_url,
      row.watermarked_video_sd_url,
      row.watermarked_video_hd_url
    )
    const imageUrl = pickString(
      row.original_image_url,
      row.resized_image_url,
      row.watermarked_resized_image_url,
      videoPreviewUrl
    )

    if (imageUrl || videoUrl) {
      return {
        imageUrl,
        videoPreviewUrl,
        videoUrl,
        title,
      }
    }
  }

  const videos = valuesFromListOrMap(snapshot.videos)
  for (const video of videos) {
    const row = asRecord(video)
    if (!row) continue
    const videoPreviewUrl = pickString(row.video_preview_image_url, row.thumbnail_url)
    const videoUrl = pickString(row.video_sd_url, row.video_hd_url)
    if (videoPreviewUrl || videoUrl) {
      return {
        imageUrl: videoPreviewUrl,
        videoPreviewUrl,
        videoUrl,
        title,
      }
    }
  }

  const images = valuesFromListOrMap(snapshot.images)
  for (const image of images) {
    const row = asRecord(image)
    const imageUrl = pickString(
      row?.original_image_url,
      row?.resized_image_url,
      row?.url,
      typeof image === "string" ? image : null
    )
    if (imageUrl) {
      return {
        imageUrl,
        videoPreviewUrl: null,
        videoUrl: null,
        title,
      }
    }
  }

  const pageImage = pickString(snapshot.page_profile_picture_url)
  if (pageImage) {
    return {
      imageUrl: pageImage,
      videoPreviewUrl: null,
      videoUrl: null,
      title,
    }
  }

  return {
    imageUrl: null,
    videoPreviewUrl: null,
    videoUrl: null,
    title,
  }
}

function parseAdRow(row: Record<string, unknown>): FacebookAdLibraryAd | null {
  const adArchiveId = pickString(row.ad_archive_id)
  if (!adArchiveId) return null

  const snapshot = asRecord(row.snapshot)
  const cards = valuesFromListOrMap(snapshot?.cards)
  const firstCard = asRecord(cards[0])
  const creative = extractCreativeFromSnapshot(snapshot)

  return {
    adArchiveId,
    pageId: pickString(row.page_id, snapshot?.page_id),
    title: pickString(snapshot?.title, firstCard?.title, creative.title),
    body: pickString(asRecord(snapshot?.body)?.text, firstCard?.body),
    imageUrl: creative.imageUrl ?? creative.videoPreviewUrl,
    videoPreviewUrl: creative.videoPreviewUrl,
    videoUrl: creative.videoUrl,
    isActive: row.is_active === true,
    linkUrl: pickString(firstCard?.link_url, snapshot?.link_url),
    pageName: pickString(row.page_name, snapshot?.page_name),
    pageImageUrl: pickString(snapshot?.page_profile_picture_url),
    startDate: pickString(row.start_date_string),
    endDate: pickString(row.end_date_string),
    format: inferAdFormat(snapshot, firstCard, cards.length),
    collationCount: pickNumber(row.collation_count),
    ctaText: pickString(snapshot?.cta_text, firstCard?.cta_text),
    publisherPlatforms: parsePublisherPlatforms(row.publisher_platform),
  }
}

function sociavaultErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    if (data?.error) return data.error
    return error.message
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return "Error al consultar SociaVault"
}

function adLibraryCountryParam(country?: string): string {
  return (
    country?.trim() ||
    process.env.SOCIAVAULT_AD_LIBRARY_COUNTRY?.trim() ||
    "ALL"
  )
}

function parseFacebookAdLibraryResponse(
  data: unknown,
  resultsKey: "results" | "searchResults",
  status: "ACTIVE" | "ALL" = "ALL"
): FacebookCompanyAdsResult {
  const root = asRecord(data) ?? {}
  if (root.success === false) {
    throw new Error(pickString(root.error) ?? "SociaVault rechazó la consulta de anuncios.")
  }

  const inner = asRecord(root.data) ?? root
  const rows = valuesFromListOrMap(inner[resultsKey] ?? inner.results ?? inner.searchResults)
  const ads = rows
    .map((item) => asRecord(item))
    .filter(Boolean)
    .map((row) => parseAdRow(row!))
    .filter((row): row is FacebookAdLibraryAd => row != null)

  const totalCount = pickNumber(inner.searchResultsCount) ?? ads.length
  const parsedActiveCount = ads.filter((ad) => ad.isActive).length
  const activeCount =
    status === "ACTIVE" ? totalCount : Math.max(parsedActiveCount, 0)

  const firstRow = asRecord(rows[0])
  const snapshot = asRecord(firstRow?.snapshot)
  const company: FacebookAdLibraryCompany | null =
    pickString(firstRow?.page_id, snapshot?.page_id) &&
    pickString(firstRow?.page_name, snapshot?.page_name)
      ? {
          pageId: pickString(firstRow?.page_id, snapshot?.page_id)!,
          name: pickString(firstRow?.page_name, snapshot?.page_name)!,
          imageUrl: pickString(snapshot?.page_profile_picture_url),
          category: null,
          likes: null,
        }
      : null

  return {
    company,
    ads,
    activeCount,
    totalCount,
    warning: null,
  }
}

export async function searchFacebookAdLibraryCompanies(
  query: string
): Promise<FacebookAdLibraryCompany[]> {
  const client = getSociaVaultClient()
  const { data } = await client.get("/v1/scrape/facebook-ad-library/search-companies", {
    params: { query },
  })

  const root = asRecord(data) ?? {}
  if (root.success === false) {
    throw new Error(pickString(root.error) ?? "SociaVault rechazó la búsqueda de empresas.")
  }

  const inner = asRecord(root.data) ?? root
  const results = valuesFromListOrMap(inner.searchResults ?? inner.results)

  return results
    .map((item) => asRecord(item))
    .filter(Boolean)
    .map((row) => parseCompanyRow(row!))
    .filter((row): row is FacebookAdLibraryCompany => row != null)
}

export async function searchFacebookAdLibraryAds(input: {
  query: string
  country?: string
  status?: "ACTIVE" | "ALL"
}): Promise<FacebookCompanyAdsResult> {
  const query = input.query.trim()
  if (!query) {
    return {
      company: null,
      ads: [],
      activeCount: 0,
      totalCount: 0,
      warning: "Indica una palabra clave para buscar anuncios.",
    }
  }

  const client = getSociaVaultClient()

  try {
    const { data } = await client.get("/v1/scrape/facebook-ad-library/search", {
      params: {
        query,
        country: adLibraryCountryParam(input.country),
        status: input.status ?? "ALL",
        trim: false,
      },
      timeout: 90_000,
    })

    return parseFacebookAdLibraryResponse(
      data,
      "searchResults",
      input.status ?? "ALL"
    )
  } catch (error) {
    return {
      company: null,
      ads: [],
      activeCount: 0,
      totalCount: 0,
      warning: sociavaultErrorMessage(error),
    }
  }
}

export function adTextMentionsDomain(
  ad: FacebookAdLibraryAd,
  domain: string
): boolean {
  const needle = domain.replace(/^www\./i, "").toLowerCase()
  const haystack = [ad.title, ad.body, ad.linkUrl, ad.pageName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(needle)
}

export function domainBrandFromHost(domain: string): string | null {
  const host = domain.replace(/^www\./i, "").trim()
  if (!host) return null
  const parts = host.split(".")
  if (parts.length >= 2) return parts[0] || null
  return host
}

export function linkUrlMatchesDomain(
  linkUrl: string | null | undefined,
  domain: string
): boolean {
  if (!linkUrl) return false
  try {
    const host = new URL(linkUrl).hostname.replace(/^www\./i, "")
    const target = domain.replace(/^www\./i, "")
    return host === target || host.endsWith(`.${target}`)
  } catch {
    return linkUrl.toLowerCase().includes(domain.toLowerCase())
  }
}

export async function resolveFacebookAdLibraryCompany(input: {
  facebookPage?: string | null
  storeUrl?: string | null
}): Promise<{
  pageId?: string
  companyName?: string
  company: FacebookAdLibraryCompany | null
}> {
  const queries: string[] = []

  if (input.facebookPage) {
    const parsed = parseFacebookPageInput(input.facebookPage)
    if (parsed.pageId) {
      return { pageId: parsed.pageId, company: null }
    }
    if (parsed.companyName) queries.push(parsed.companyName)
  }

  if (input.storeUrl) {
    const domain = domainLabelFromUrl(input.storeUrl)
    if (domain) {
      queries.push(domain)
      const brand = domainBrandFromHost(domain)
      if (brand && !queries.some((q) => q.toLowerCase() === brand.toLowerCase())) {
        queries.push(brand)
      }
    }
  }

  const seen = new Set<string>()
  for (const query of queries) {
    const key = query.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    try {
      const companies = await searchFacebookAdLibraryCompanies(query)
      if (companies[0]) {
        return { pageId: companies[0].pageId, company: companies[0] }
      }
    } catch (error) {
      const message = sociavaultErrorMessage(error)
      if (/401|402|api key|credit/i.test(message)) {
        throw error
      }
    }
  }

  return {
    companyName: queries[0],
    company: null,
  }
}

export async function fetchFacebookCompanyAds(input: {
  pageId?: string | null
  companyName?: string | null
  country?: string
  status?: "ACTIVE" | "ALL"
}): Promise<FacebookCompanyAdsResult> {
  const pageId = input.pageId?.trim() || undefined
  const companyName = input.companyName?.trim() || undefined

  if (!pageId && !companyName) {
    return {
      company: null,
      ads: [],
      activeCount: 0,
      totalCount: 0,
      warning: "Indica una página de Facebook para buscar anuncios.",
    }
  }

  const client = getSociaVaultClient()

  try {
    const { data } = await client.get("/v1/scrape/facebook-ad-library/company-ads", {
      params: {
        ...(pageId ? { pageId } : {}),
        ...(companyName ? { companyName } : {}),
        country: adLibraryCountryParam(input.country),
        status: input.status ?? "ALL",
        trim: false,
      },
      timeout: 90_000,
    })

    return parseFacebookAdLibraryResponse(
      data,
      "results",
      input.status ?? "ALL"
    )
  } catch (error) {
    return {
      company: null,
      ads: [],
      activeCount: 0,
      totalCount: 0,
      warning: sociavaultErrorMessage(error),
    }
  }
}

export function parseFacebookPageInput(raw: string): {
  pageId?: string
  companyName?: string
} {
  const trimmed = raw.trim()
  if (!trimmed) return {}

  if (/^\d{5,}$/.test(trimmed)) {
    return { pageId: trimmed }
  }

  if (/facebook\.com|fb\.com/i.test(trimmed)) {
    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
      const idParam = url.searchParams.get("id")
      if (idParam) return { pageId: idParam }

      const parts = url.pathname.split("/").filter(Boolean)
      if (parts[0] === "pages" && parts[2] && /^\d+$/.test(parts[2])) {
        return { pageId: parts[2] }
      }
      const slug = parts[parts.length - 1]
      if (slug && slug !== "profile.php") {
        return { companyName: decodeURIComponent(slug) }
      }
    } catch {
      return { companyName: trimmed }
    }
  }

  return { companyName: trimmed }
}

export function domainLabelFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "")
    return host || null
  } catch {
    return null
  }
}
