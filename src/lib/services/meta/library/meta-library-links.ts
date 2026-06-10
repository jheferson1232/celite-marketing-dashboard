function parseFacebookPageInput(raw: string): {
  pageId?: string
  companyName?: string
  profileUrl?: string
} {
  const trimmed = raw.trim()
  if (!trimmed) return {}

  if (/^\d{5,}$/.test(trimmed)) {
    return { pageId: trimmed }
  }

  if (/facebook\.com|fb\.com/i.test(trimmed)) {
    const profileUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    try {
      const url = new URL(profileUrl)
      const idParam = url.searchParams.get("id")
      if (idParam) return { pageId: idParam, profileUrl }

      const parts = url.pathname.split("/").filter(Boolean)
      if (parts[0] === "pages" && parts[2] && /^\d+$/.test(parts[2])) {
        return { pageId: parts[2], profileUrl }
      }
      const slug = parts[parts.length - 1]
      if (slug && slug !== "profile.php") {
        return { companyName: decodeURIComponent(slug), profileUrl }
      }
      return { profileUrl }
    } catch {
      return { companyName: trimmed }
    }
  }

  return { companyName: trimmed.replace(/^@/, "") }
}

function buildAdLibraryPageUrl(pageId: string): string {
  const params = new URLSearchParams({
    active_status: "all",
    ad_type: "all",
    country: "ALL",
    view_all_page_id: pageId,
    search_type: "page",
    media_type: "all",
  })
  return `https://www.facebook.com/ads/library/?${params.toString()}`
}

function buildAdLibraryKeywordUrl(query: string): string {
  const params = new URLSearchParams({
    active_status: "all",
    ad_type: "all",
    country: "ALL",
    q: query,
    search_type: "keyword_unordered",
    media_type: "all",
  })
  return `https://www.facebook.com/ads/library/?${params.toString()}`
}

/** Término de búsqueda según lo que el usuario registró (tienda / página). */
export function adLibraryQueryFromEntry(input: {
  entryUrl?: string | null
  facebookPage?: string | null
}): string | null {
  const entryUrl = input.entryUrl?.trim()
  if (entryUrl) {
    try {
      const host = new URL(
        entryUrl.startsWith("http") ? entryUrl : `https://${entryUrl}`
      ).hostname.replace(/^www\./i, "")
      if (host) return host
    } catch {
      return entryUrl.replace(/^@/, "")
    }
  }

  const facebookPage = input.facebookPage?.trim()
  if (!facebookPage) return null

  const parsed = parseFacebookPageInput(facebookPage)
  if (parsed.companyName) return parsed.companyName

  if (!/facebook\.com|fb\.com/i.test(facebookPage)) {
    return facebookPage.replace(/^@/, "")
  }

  return null
}

export function facebookAdLibrarySearchUrl(input: {
  entryUrl?: string | null
  facebookPage?: string | null
  /** Solo para fallback si el usuario no dejó tienda ni keyword en página. */
  resolvedPageId?: string | null
  resolvedCompanyName?: string | null
  /** @deprecated Usa entryUrl. Se mantiene por compatibilidad interna. */
  pageId?: string | null
  storeDomain?: string | null
  companyName?: string | null
}): string | null {
  const userFacebookPage = input.facebookPage?.trim()
  const userPageId = userFacebookPage
    ? parseFacebookPageInput(userFacebookPage).pageId
    : undefined

  if (userPageId) {
    return buildAdLibraryPageUrl(userPageId)
  }

  const userQuery =
    adLibraryQueryFromEntry({
      entryUrl: input.entryUrl ?? input.storeDomain,
      facebookPage: input.facebookPage,
    }) ??
    input.storeDomain?.trim().replace(/^www\./i, "") ??
    null

  if (userQuery) {
    return buildAdLibraryKeywordUrl(userQuery)
  }

  const resolvedPageId = input.resolvedPageId?.trim() || input.pageId?.trim()
  if (resolvedPageId) {
    return buildAdLibraryPageUrl(resolvedPageId)
  }

  const resolvedName =
    input.resolvedCompanyName?.trim() || input.companyName?.trim()
  if (resolvedName) {
    return buildAdLibraryKeywordUrl(resolvedName)
  }

  return null
}

export function facebookPageProfileUrl(input: {
  facebookPage?: string | null
  pageId?: string | null
}): string | null {
  const pageId = input.pageId?.trim() || undefined
  const facebookPage = input.facebookPage?.trim() || undefined

  if (facebookPage) {
    const parsed = parseFacebookPageInput(facebookPage)
    if (parsed.profileUrl) return parsed.profileUrl
    if (parsed.pageId) {
      return `https://www.facebook.com/profile.php?id=${parsed.pageId}`
    }
    if (parsed.companyName) {
      return `https://www.facebook.com/${encodeURIComponent(parsed.companyName)}`
    }
  }

  if (pageId) {
    return `https://www.facebook.com/profile.php?id=${pageId}`
  }

  return null
}
