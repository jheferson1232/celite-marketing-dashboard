import type { MetaApiClient } from "./meta"
import { metaGraphGet } from "./meta-graph-retry"

type MetaPagedResponse<T> = {
  data: T[]
  paging?: { next?: string }
}

type FetchAllMetaPagesOptions = {
  maxPages?: number
}

/** Recorre todas las páginas de un endpoint Meta Graph (paging.next). */
export async function fetchAllMetaPages<T>(
  api: MetaApiClient,
  path: string,
  params: Record<string, string>,
  options?: FetchAllMetaPagesOptions
): Promise<T[]> {
  const items: T[] = []
  let response = await api.get<MetaPagedResponse<T>>(path, { params })
  items.push(...(response.data.data ?? []))

  let nextUrl = response.data.paging?.next
  let pageCount = 1
  const maxPages = options?.maxPages

  while (nextUrl && (maxPages === undefined || pageCount < maxPages)) {
    const nextPage = await metaGraphGet<MetaPagedResponse<T>>(nextUrl)
    items.push(...(nextPage.data ?? []))
    nextUrl = nextPage.paging?.next
    pageCount += 1
  }

  return items
}
