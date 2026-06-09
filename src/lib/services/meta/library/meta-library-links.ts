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

export function facebookAdLibrarySearchUrl(input: {
  facebookPage?: string | null
  pageId?: string | null
  storeDomain?: string | null
  companyName?: string | null
}): string | null {
  const pageId =
    input.pageId?.trim() ||
    (input.facebookPage ? parseFacebookPageInput(input.facebookPage).pageId : undefined)

  if (pageId) {
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

  const parsedPage = input.facebookPage
    ? parseFacebookPageInput(input.facebookPage)
    : {}

  const query =
    input.companyName?.trim() ||
    parsedPage.companyName ||
    input.storeDomain?.trim() ||
    (input.facebookPage && !/facebook\.com|fb\.com/i.test(input.facebookPage)
      ? input.facebookPage.trim().replace(/^@/, "")
      : undefined)

  if (!query) return null

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
