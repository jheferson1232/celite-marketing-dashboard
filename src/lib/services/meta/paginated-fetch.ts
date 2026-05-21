import axios from "axios"
import type { AxiosInstance } from "axios"

type MetaPagedResponse<T> = {
  data: T[]
  paging?: { next?: string }
}

/** Recorre todas las páginas de un endpoint Meta Graph (paging.next). */
export async function fetchAllMetaPages<T>(
  api: AxiosInstance,
  path: string,
  params: Record<string, string>
): Promise<T[]> {
  const items: T[] = []
  let response = await api.get<MetaPagedResponse<T>>(path, { params })
  items.push(...(response.data.data ?? []))

  let nextUrl = response.data.paging?.next
  while (nextUrl) {
    const nextResponse = await axios.get<MetaPagedResponse<T>>(nextUrl)
    items.push(...(nextResponse.data.data ?? []))
    nextUrl = nextResponse.data.paging?.next
  }

  return items
}
