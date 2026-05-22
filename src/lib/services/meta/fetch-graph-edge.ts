import { metaGraphGet } from "./meta-graph-retry"

type MetaPagedResponse<T> = {
  data: T[]
  paging?: { next?: string }
}

type FetchGraphEdgeOptions = {
  /** Máximo de páginas (limit × páginas). Evita barrer campañas enormes. */
  maxPages?: number
}

function buildGraphEdgeUrl(
  objectId: string,
  edge: string,
  params: Record<string, string>,
  token: string
): string {
  const url = new URL(
    `https://graph.facebook.com/v25.0/${objectId}/${edge}`
  )
  url.searchParams.set("access_token", token)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

/** Paginación en un edge de objeto Meta (`/{objectId}/{edge}`), fuera del prefijo act_. */
export async function fetchAllGraphEdgePages<T>(
  objectId: string,
  edge: string,
  params: Record<string, string>,
  options?: FetchGraphEdgeOptions
): Promise<T[]> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) {
    throw new Error("META_ACCESS_TOKEN es requerida")
  }

  const items: T[] = []
  const firstUrl = buildGraphEdgeUrl(objectId, edge, params, token)

  let response = await metaGraphGet<MetaPagedResponse<T>>(firstUrl)
  items.push(...(response.data ?? []))

  let nextUrl = response.paging?.next
  let pageCount = 1
  const maxPages = options?.maxPages

  while (nextUrl && (maxPages === undefined || pageCount < maxPages)) {
    response = await metaGraphGet<MetaPagedResponse<T>>(nextUrl)
    items.push(...(response.data ?? []))
    nextUrl = response.paging?.next
    pageCount += 1
  }

  return items
}
