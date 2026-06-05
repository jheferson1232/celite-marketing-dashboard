import axios from "axios"
import { getSociaVaultClient } from "./sociavault-client"
import {
  normalizeStoreDomain,
  parseMetaAdResults,
  type MetaAdCreativeCandidate,
} from "./meta-ad-library-parse"
import { asRecord, pickString } from "./sociavault-parse-utils"

export type StoreMetaSearchInput = {
  name: string
  domain?: string | null
  pageUrl?: string | null
  country?: string | null
  metaPageId?: string | null
}

export type StoreMetaSearchOutcome = {
  metaPageId: string | null
  logoUrl: string | null
  companyName: string | null
  totalAds: number
  activeAds: number
  creatives: MetaAdCreativeCandidate[]
  topCountries: Array<{ code: string; count: number }>
  warnings: string[]
  creditsUsed: number
  searchQuery: string | null
}

function getStoreMetaConfig() {
  const maxAds = Number.parseInt(
    process.env.SOCIAVAULT_STORE_MAX_ADS ?? "30",
    10
  )
  return {
    maxAds: Number.isFinite(maxAds) && maxAds > 0 ? Math.min(maxAds, 100) : 30,
    country:
      process.env.SOCIAVAULT_AD_LIBRARY_COUNTRY?.trim() ||
      process.env.SOCIAVAULT_STORE_DEFAULT_COUNTRY?.trim() ||
      "ALL",
  }
}

function isFacebookHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "")
  return host === "facebook.com" || host === "fb.com" || host.endsWith(".facebook.com")
}

function isFacebookPageUrl(pageUrl: string | null | undefined): boolean {
  const raw = pageUrl?.trim()
  if (!raw) return false
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`)
    return isFacebookHost(url.hostname)
  } catch {
    return false
  }
}

function sociavaultErrorMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: string; available?: number }
      | undefined
    if (data?.error) {
      if (typeof data.available === "number") {
        return `${data.error} (disponibles: ${data.available})`
      }
      return data.error
    }
    const status = error.response?.status
    if (status) return `HTTP ${status}: ${error.message}`
    return error.message
  }
  if (error instanceof Error && error.message.trim()) return error.message
  return null
}

function assertSociaVaultSuccess(data: unknown, fallback: string) {
  const root = asRecord(data) ?? {}
  if (root.success === false) {
    throw new Error(pickString(root.error) ?? fallback)
  }
}

async function fetchCompanyAds(params: {
  companyName?: string
  pageId?: string
  country: string
  status?: string
  maxResults: number
}): Promise<{
  creatives: MetaAdCreativeCandidate[]
  totalAds: number | null
  activeAds: number | null
  creditsUsed: number
}> {
  const client = getSociaVaultClient()
  const { data } = await client.get(
    "/v1/scrape/facebook-ad-library/company-ads",
    {
      params: {
        ...(params.pageId ? { pageId: params.pageId } : {}),
        ...(params.companyName ? { companyName: params.companyName } : {}),
        country: params.country,
        status: params.status ?? "ACTIVE",
        trim: true,
      },
      timeout: 120_000,
    }
  )
  assertSociaVaultSuccess(data, "SociaVault rechazó la consulta de anuncios.")

  const parsed = parseMetaAdResults(data, { maxResults: params.maxResults })
  return {
    creatives: parsed.results,
    totalAds: parsed.totalAds,
    activeAds: parsed.activeAds,
    creditsUsed: 1,
  }
}

async function searchMetaAdsByKeyword(params: {
  query: string
  country: string
  maxResults: number
  domain?: string | null
}): Promise<{
  creatives: MetaAdCreativeCandidate[]
  totalAds: number | null
  activeAds: number | null
  creditsUsed: number
}> {
  const client = getSociaVaultClient()
  const { data } = await client.get(
    "/v1/scrape/facebook-ad-library/search",
    {
      params: {
        query: params.query,
        country: params.country,
        status: "ACTIVE",
        trim: true,
      },
      timeout: 120_000,
    }
  )
  assertSociaVaultSuccess(data, "SociaVault rechazó la búsqueda por keyword.")

  const parsed = parseMetaAdResults(data, {
    domain: params.domain,
    maxResults: params.maxResults,
  })
  return {
    creatives: parsed.results,
    totalAds: parsed.totalAds,
    activeAds: parsed.activeAds,
    creditsUsed: 1,
  }
}

function creativeMentionsDomain(
  creative: MetaAdCreativeCandidate,
  domain: string
): boolean {
  const haystack = [
    creative.landingUrl,
    creative.title,
    creative.pageName,
    JSON.stringify(creative.payload),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return haystack.includes(domain.toLowerCase())
}

function preferDomainRelevantCreatives(
  creatives: MetaAdCreativeCandidate[],
  domain: string
): MetaAdCreativeCandidate[] {
  const relevant = creatives.filter((creative) =>
    creativeMentionsDomain(creative, domain)
  )
  return relevant.length > 0 ? relevant : creatives
}

export async function searchStoreMetaAds(
  input: StoreMetaSearchInput
): Promise<StoreMetaSearchOutcome> {
  const name = input.name.trim()
  if (!name) {
    return {
      metaPageId: null,
      logoUrl: null,
      companyName: null,
      totalAds: 0,
      activeAds: 0,
      creatives: [],
      topCountries: [],
      warnings: ["El nombre de la tienda es obligatorio."],
      creditsUsed: 0,
      searchQuery: null,
    }
  }

  const config = getStoreMetaConfig()
  const country = input.country?.trim().toUpperCase() || config.country
  const storeDomain = input.domain
    ? normalizeStoreDomain(input.domain)
    : null
  const facebookPage = isFacebookPageUrl(input.pageUrl)
  const metaPageId = input.metaPageId?.trim() || null

  const warnings: string[] = []
  let creditsUsed = 0
  let logoUrl: string | null = null
  let companyName: string | null = name
  let creatives: MetaAdCreativeCandidate[] = []
  let totalAds: number | null = null
  let activeAds: number | null = null
  let searchQuery: string | null = null

  try {
    if (storeDomain) {
      const keywordAds = await searchMetaAdsByKeyword({
        query: storeDomain,
        country,
        domain: storeDomain,
        maxResults: config.maxAds,
      })
      creditsUsed += keywordAds.creditsUsed
      creatives = preferDomainRelevantCreatives(
        keywordAds.creatives,
        storeDomain
      ).slice(0, config.maxAds)
      totalAds = keywordAds.totalAds
      activeAds = keywordAds.activeAds
      searchQuery = storeDomain
    } else if (metaPageId || facebookPage) {
      const companyAds = await fetchCompanyAds({
        pageId: metaPageId ?? undefined,
        companyName: metaPageId ? undefined : name,
        country,
        maxResults: config.maxAds,
      })
      creditsUsed += companyAds.creditsUsed
      creatives = companyAds.creatives
      totalAds = companyAds.totalAds
      activeAds = companyAds.activeAds
      searchQuery = name
    } else {
      const companyAds = await fetchCompanyAds({
        companyName: name,
        country,
        maxResults: config.maxAds,
      })
      creditsUsed += companyAds.creditsUsed
      creatives = companyAds.creatives
      totalAds = companyAds.totalAds
      activeAds = companyAds.activeAds
      searchQuery = name
    }
  } catch (error) {
    warnings.push(sociavaultErrorMessage(error) ?? "Sin respuesta de SociaVault.")
  }

  const resolvedActive =
    activeAds ?? creatives.filter((item) => item.isActive).length
  const resolvedTotal = totalAds ?? creatives.length

  const topCountries =
    country && country !== "ALL"
      ? [{ code: country, count: creatives.length }]
      : []

  if (creatives.length === 0 && warnings.length === 0) {
    warnings.push("Sin anuncios Meta para esta tienda con los criterios actuales.")
  }

  return {
    metaPageId,
    logoUrl,
    companyName,
    totalAds: resolvedTotal,
    activeAds: resolvedActive,
    creatives,
    topCountries,
    warnings,
    creditsUsed,
    searchQuery,
  }
}

export function describeStoreMetaCreditsPerScrape(): string {
  return "1 crédito/scrape (dominio → búsqueda Meta; Facebook → anuncios de página)"
}
