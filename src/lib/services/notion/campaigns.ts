import { getNotionCampaignsDatabaseId, getNotionHeaders } from "./config"

type NotionPage = {
  id: string
  properties: Record<string, NotionProperty>
}

type NotionProperty = {
  title?: { plain_text: string }[]
  rich_text?: { plain_text: string }[]
  select?: { name: string } | null
  number?: number | null
  url?: string | null
  date?: { start: string } | null
}

export type NotionCampaignDraft = {
  pageId: string
  name: string
  dailyBudget: number | null
  urls: string[]
  platform: string | null
}

function getTitle(props: Record<string, NotionProperty>): string {
  const title = props.Nombre?.title?.[0]?.plain_text
  return title?.trim() ?? ""
}

function ensureHttps(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  return `https://${trimmed}`
}

/** URL, URL 1, URL 2… y fallback URLs (rich_text). */
export function extractUrlsFromNotionProperties(
  props: Record<string, NotionProperty>
): string[] {
  const ordered: string[] = []

  const main = props.URL?.url
  if (main) ordered.push(ensureHttps(main))

  for (let i = 1; i <= 30; i++) {
    const prop = props[`URL ${i}`]?.url
    if (prop) ordered.push(ensureHttps(prop))
  }

  const rich =
    props.URLs?.rich_text?.map((t) => t.plain_text).join("") ?? ""
  if (rich.trim()) {
    for (const line of rich.split("\n")) {
      const lineUrl = line.trim()
      if (lineUrl) ordered.push(ensureHttps(lineUrl))
    }
  }

  const seen = new Set<string>()
  const unique: string[] = []
  for (const url of ordered) {
    const key = url.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(url)
    }
  }
  return unique
}

function pageToDraft(page: NotionPage): NotionCampaignDraft | null {
  const props = page.properties
  const name = getTitle(props)
  if (!name) return null

  return {
    pageId: page.id,
    name,
    dailyBudget: props["Presupuesto diario"]?.number ?? null,
    urls: extractUrlsFromNotionProperties(props),
    platform: props.Plataforma?.select?.name ?? null,
  }
}

async function queryNotionDatabase(
  filter: Record<string, unknown>
): Promise<NotionPage[]> {
  const dbId = getNotionCampaignsDatabaseId()
  const results: NotionPage[] = []
  let cursor: string | undefined

  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: getNotionHeaders(),
      body: JSON.stringify({
        filter,
        start_cursor: cursor,
        page_size: 100,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Notion query failed: ${res.status} ${body}`)
    }

    const data = (await res.json()) as {
      results: NotionPage[]
      has_more: boolean
      next_cursor: string | null
    }
    results.push(...data.results)
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined
  } while (cursor)

  return results
}

export async function listNotionCampaignDrafts(): Promise<NotionCampaignDraft[]> {
  const pages = await queryNotionDatabase({
    property: "Estado",
    select: { equals: "Borrador" },
  })

  return pages
    .map(pageToDraft)
    .filter((d): d is NotionCampaignDraft => d !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getNotionCampaignDraftByPageId(
  pageId: string
): Promise<NotionCampaignDraft | null> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: getNotionHeaders(),
  })
  if (!res.ok) {
    throw new Error(`Notion page ${pageId}: ${res.status}`)
  }
  const page = (await res.json()) as NotionPage
  const draft = pageToDraft(page)
  if (!draft) return null
  const estado = page.properties.Estado?.select?.name ?? ""
  if (estado !== "Borrador") return null
  return draft
}

export async function markNotionCampaignLaunched(
  pageId: string,
  details: { campaignId: string; adGroupCount: number }
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: getNotionHeaders(),
    body: JSON.stringify({
      properties: {
        Estado: { select: { name: "En curso" } },
        "Fecha lanzamiento": { date: { start: today } },
        Adgroups: { number: details.adGroupCount },
        "Campaign ID": {
          rich_text: [{ text: { content: details.campaignId } }],
        },
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Notion patch failed: ${res.status} ${body}`)
  }
}
