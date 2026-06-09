import type { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"
import {
  fetchLandingPagePreviewImage,
  fetchStorePreviewImages,
} from "@/lib/services/landing-page-preview"
import {
  adTextMentionsDomain,
  domainBrandFromHost,
  domainLabelFromUrl,
  fetchFacebookCompanyAds,
  linkUrlMatchesDomain,
  resolveFacebookAdLibraryCompany,
  searchFacebookAdLibraryAds,
  type FacebookAdLibraryAd,
  type FacebookAdLibraryCompany,
  type FacebookCompanyAdsResult,
} from "@/lib/services/sociavault/facebook-ad-library"
import { isSociaVaultApiKeyConfigured } from "@/lib/services/sociavault/sociavault-setup"
import {
  buildMetaLibraryAnalytics,
  type MetaLibraryAnalytics,
} from "./meta-library-analytics"
import type { MetaLibraryEntryRecord } from "./meta-library-entries"

export type MetaLibraryPreviewSlide = {
  imageUrl: string
  videoUrl: string | null
  title: string | null
  isActive: boolean
}

export type MetaLibraryAdsPayload = {
  entryId: string
  company: FacebookAdLibraryCompany | null
  ads: FacebookAdLibraryAd[]
  previewSlides: MetaLibraryPreviewSlide[]
  activeCount: number
  totalCount: number
  domain: string | null
  warning: string | null
  configured: boolean
}

function buildPreviewSlides(
  ads: FacebookAdLibraryAd[],
  company: FacebookAdLibraryCompany | null,
  storeImages: string[],
  storeTitle: string | null
): MetaLibraryPreviewSlide[] {
  const slides: MetaLibraryPreviewSlide[] = []
  const sorted = [...ads].sort((a, b) => Number(b.isActive) - Number(a.isActive))

  for (const ad of sorted) {
    const imageUrl = ad.imageUrl ?? ad.videoPreviewUrl ?? ad.pageImageUrl
    if (!imageUrl) continue

    slides.push({
      imageUrl,
      videoUrl: ad.videoUrl,
      title: ad.title,
      isActive: ad.isActive,
    })
    if (slides.length >= 8) break
  }

  if (slides.length > 0) return slides

  const pageImage =
    company?.imageUrl ?? ads.find((ad) => ad.pageImageUrl)?.pageImageUrl ?? null

  if (pageImage) {
    return [
      {
        imageUrl: pageImage,
        videoUrl: null,
        title: company?.name ?? ads[0]?.pageName ?? storeTitle,
        isActive: true,
      },
    ]
  }

  if (storeImages.length > 0) {
    return storeImages.slice(0, 8).map((imageUrl, index) => ({
      imageUrl,
      videoUrl: null,
      title: index === 0 ? storeTitle : null,
      isActive: true,
    }))
  }

  return []
}

function normalizeStoreUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

async function fetchStoreImagesForEntry(
  entry: MetaLibraryEntryRecord,
  ads: FacebookAdLibraryAd[]
): Promise<{ images: string[]; title: string | null }> {
  const urls: string[] = []
  const seen = new Set<string>()

  const pushUrl = (raw: string | null | undefined) => {
    const normalized = raw ? normalizeStoreUrl(raw) : null
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    urls.push(normalized)
  }

  pushUrl(entry.url)

  for (const ad of ads) {
    pushUrl(ad.linkUrl)
    if (ad.linkUrl) {
      try {
        pushUrl(new URL(ad.linkUrl).origin)
      } catch {
        // ignore invalid URLs
      }
    }
  }

  const images: string[] = []
  let title: string | null = null

  for (const url of urls) {
    const result = await fetchStorePreviewImages(url)
    if (!title && result.title) title = result.title
    for (const image of result.images) {
      if (!images.includes(image)) images.push(image)
    }
    if (images.length >= 8) break
  }

  return { images, title }
}

export type MetaLibraryDetailPayload = MetaLibraryAdsPayload & {
  entry: MetaLibraryEntryRecord
  allAds: FacebookAdLibraryAd[]
  analytics: MetaLibraryAnalytics
}

function isSociaVaultFatalWarning(warning: string | null): boolean {
  if (!warning) return false
  return /401|402|api key|credit|insufficient/i.test(warning)
}

function buildDomainSearchQueries(
  domain: string | null,
  companyName?: string
): string[] {
  const queries: string[] = []
  if (domain) queries.push(domain)
  if (domain) {
    const brand = domainBrandFromHost(domain)
    if (brand && !queries.some((q) => q.toLowerCase() === brand.toLowerCase())) {
      queries.push(brand)
    }
  }
  if (
    companyName &&
    !queries.some((q) => q.toLowerCase() === companyName.toLowerCase())
  ) {
    queries.push(companyName)
  }
  return queries
}

function filterAdsForDomain(
  ads: FacebookAdLibraryAd[],
  domain: string,
  query: string
): FacebookAdLibraryAd[] {
  if (query.toLowerCase() === domain.toLowerCase()) {
    return ads
  }

  const filtered = ads.filter(
    (ad) =>
      linkUrlMatchesDomain(ad.linkUrl, domain) || adTextMentionsDomain(ad, domain)
  )
  return filtered.length > 0 ? filtered : ads
}

async function searchAdsByDomainKeywords(input: {
  domain: string | null
  companyName?: string
}): Promise<FacebookCompanyAdsResult | null> {
  const queries = buildDomainSearchQueries(input.domain, input.companyName)
  if (queries.length === 0) return null

  for (const query of queries) {
    const searchResult = await searchFacebookAdLibraryAds({
      query,
      status: "ACTIVE",
    })

    if (isSociaVaultFatalWarning(searchResult.warning)) {
      return searchResult
    }

    let ads = searchResult.ads
    if (input.domain) {
      ads = filterAdsForDomain(ads, input.domain, query)
    }

    if (ads.length > 0 || searchResult.totalCount > 0) {
      const pageId = ads.find((ad) => ad.pageId)?.pageId
      const pageName = input.companyName ?? ads[0]?.pageName ?? query
      const companyFromAds: FacebookAdLibraryCompany | null =
        pageId && pageName
          ? {
              pageId,
              name: pageName,
              imageUrl: ads[0]?.pageImageUrl ?? null,
              category: null,
              likes: null,
            }
          : null

      return {
        ...searchResult,
        ads,
        activeCount: searchResult.activeCount,
        totalCount: searchResult.totalCount,
        company: searchResult.company ?? companyFromAds,
      }
    }
  }

  return null
}

async function fetchFacebookAdsWithFallback(input: {
  target: Awaited<ReturnType<typeof resolveFacebookAdLibraryCompany>>
  storeUrl: string | null
  domain: string | null
}): Promise<FacebookCompanyAdsResult> {
  if (input.domain) {
    const domainSearch = await searchAdsByDomainKeywords({
      domain: input.domain,
      companyName: input.target.companyName,
    })
    if (
      domainSearch &&
      (domainSearch.ads.length > 0 ||
        domainSearch.totalCount > 0 ||
        isSociaVaultFatalWarning(domainSearch.warning))
    ) {
      return domainSearch
    }
  }

  const adsResult = await fetchFacebookCompanyAds({
    pageId: input.target.pageId,
    companyName: input.target.companyName,
    status: "ACTIVE",
  })

  if (adsResult.ads.length > 0 || isSociaVaultFatalWarning(adsResult.warning)) {
    return adsResult
  }

  if (!input.domain) return adsResult

  const fallbackSearch = await searchAdsByDomainKeywords({
    domain: input.domain,
    companyName: input.target.companyName,
  })

  return fallbackSearch ?? adsResult
}

async function fetchEntryAdsRaw(
  entry: MetaLibraryEntryRecord
): Promise<Omit<MetaLibraryAdsPayload, "entryId">> {
  const configured = isSociaVaultApiKeyConfigured()
  const domain = entry.url ? domainLabelFromUrl(entry.url) : null

  if (!configured) {
    const storePreview = await fetchStoreImagesForEntry(entry, [])

    return {
      company: null,
      ads: [],
      previewSlides: buildPreviewSlides(
        [],
        null,
        storePreview.images,
        storePreview.title
      ),
      activeCount: 0,
      totalCount: 0,
      domain,
      warning: "Configura SOCIAVAULT_API_KEY para ver anuncios activos.",
      configured: false,
    }
  }

  if (!entry.facebookPage && !entry.url) {
    return {
      company: null,
      ads: [],
      previewSlides: [],
      activeCount: 0,
      totalCount: 0,
      domain,
      warning: "Agrega una tienda o página de Facebook.",
      configured: true,
    }
  }

  const target = entry.facebookPage
    ? await resolveFacebookAdLibraryCompany({
        facebookPage: entry.facebookPage,
        storeUrl: entry.url,
      })
    : { company: null }
  const adsResult = await fetchFacebookAdsWithFallback({
    target,
    storeUrl: entry.url,
    domain,
  })

  const company = target.company ?? adsResult.company
  const storePreview = await fetchStoreImagesForEntry(entry, adsResult.ads)

  return {
    company,
    ads: adsResult.ads,
    previewSlides: buildPreviewSlides(
      adsResult.ads,
      company,
      storePreview.images,
      storePreview.title
    ),
    activeCount: adsResult.activeCount,
    totalCount: adsResult.totalCount,
    domain,
    warning: adsResult.warning,
    configured: true,
  }
}

type CachedAdsRow = {
  lastSyncedAt: Date | null
  syncWarning: string | null
  activeCount: number | null
  totalCount: number | null
  companyData: unknown
  adsData: unknown
  previewSlidesData: unknown
}

function parseCachedAds(data: unknown): FacebookAdLibraryAd[] {
  if (!Array.isArray(data)) return []
  return data as FacebookAdLibraryAd[]
}

function parseCachedSlides(data: unknown): MetaLibraryPreviewSlide[] {
  if (!Array.isArray(data)) return []
  return data as MetaLibraryPreviewSlide[]
}

function parseCachedCompany(data: unknown): FacebookAdLibraryCompany | null {
  if (!data || typeof data !== "object") return null
  const row = data as FacebookAdLibraryCompany
  if (!row.pageId || !row.name) return null
  return row
}

async function loadMetaLibraryAdsCache(
  entryId: string
): Promise<CachedAdsRow | null> {
  return prisma.metaLibraryEntry.findUnique({
    where: { id: entryId },
    select: {
      lastSyncedAt: true,
      syncWarning: true,
      activeCount: true,
      totalCount: true,
      companyData: true,
      adsData: true,
      previewSlidesData: true,
    },
  })
}

async function saveMetaLibraryAdsCache(
  entryId: string,
  payload: Omit<MetaLibraryAdsPayload, "entryId"> & { allAds: FacebookAdLibraryAd[] }
): Promise<void> {
  await prisma.metaLibraryEntry.update({
    where: { id: entryId },
    data: {
      lastSyncedAt: new Date(),
      syncWarning: payload.warning,
      activeCount: payload.activeCount,
      totalCount: payload.totalCount,
      companyData: (payload.company ?? null) as Prisma.InputJsonValue,
      adsData: payload.allAds as unknown as Prisma.InputJsonValue,
      previewSlidesData: payload.previewSlides as unknown as Prisma.InputJsonValue,
    },
  })
}

function payloadFromCache(
  entry: MetaLibraryEntryRecord,
  row: CachedAdsRow
): Omit<MetaLibraryAdsPayload, "entryId"> & { allAds: FacebookAdLibraryAd[] } | null {
  if (!row.lastSyncedAt || !row.adsData) return null

  const allAds = parseCachedAds(row.adsData)
  const previewSlides = parseCachedSlides(row.previewSlidesData)
  const domain = entry.url ? domainLabelFromUrl(entry.url) : null

  return {
    company: parseCachedCompany(row.companyData),
    allAds,
    ads: allAds.filter((ad) => ad.isActive),
    previewSlides,
    activeCount: row.activeCount ?? allAds.filter((ad) => ad.isActive).length,
    totalCount: row.totalCount ?? allAds.length,
    domain,
    warning: row.syncWarning,
    configured: true,
  }
}

async function buildAdsPayloadFromRaw(
  entry: MetaLibraryEntryRecord,
  raw: Omit<MetaLibraryAdsPayload, "entryId">
): Promise<Omit<MetaLibraryAdsPayload, "entryId"> & { allAds: FacebookAdLibraryAd[] }> {
  let previewSlides = raw.previewSlides
  if (previewSlides.length === 0 && entry.url) {
    const fallback = await fetchLandingPagePreviewImage(entry.url)
    if (fallback) {
      previewSlides = [
        { imageUrl: fallback, videoUrl: null, title: null, isActive: true },
      ]
    }
  }

  return {
    ...raw,
    previewSlides,
    allAds: raw.ads,
    ads: raw.ads.filter((ad) => ad.isActive),
  }
}

export async function fetchMetaLibraryEntryAds(
  entry: MetaLibraryEntryRecord,
  options?: { forceRefresh?: boolean }
): Promise<MetaLibraryAdsPayload> {
  if (!options?.forceRefresh) {
    const cached = await loadMetaLibraryAdsCache(entry.id)
    if (cached) {
      const fromCache = payloadFromCache(entry, cached)
      if (fromCache) {
        return {
          entryId: entry.id,
          ...fromCache,
          ads: fromCache.ads.slice(0, 12),
        }
      }
    }
  }

  const raw = await fetchEntryAdsRaw(entry)
  const built = await buildAdsPayloadFromRaw(entry, raw)
  await saveMetaLibraryAdsCache(entry.id, built)

  return {
    entryId: entry.id,
    ...built,
    ads: built.ads.slice(0, 12),
  }
}

export async function fetchMetaLibraryEntryDetail(
  entry: MetaLibraryEntryRecord,
  options?: { forceRefresh?: boolean }
): Promise<MetaLibraryDetailPayload> {
  if (!options?.forceRefresh) {
    const cached = await loadMetaLibraryAdsCache(entry.id)
    if (cached) {
      const fromCache = payloadFromCache(entry, cached)
      if (fromCache) {
        return {
          entryId: entry.id,
          entry,
          ...fromCache,
          analytics: buildMetaLibraryAnalytics(fromCache.allAds),
        }
      }
    }
  }

  const raw = await fetchEntryAdsRaw(entry)
  const built = await buildAdsPayloadFromRaw(entry, raw)
  await saveMetaLibraryAdsCache(entry.id, built)

  return {
    entryId: entry.id,
    entry,
    ...built,
    analytics: buildMetaLibraryAnalytics(built.allAds),
  }
}
