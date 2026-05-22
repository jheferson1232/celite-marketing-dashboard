import { metaGraphFetchJson } from "./meta-graph-fetch"

/** GET a URL absoluta de Graph API (p. ej. paging.next) con caché y reintentos. */
export async function metaGraphGet<T>(url: string): Promise<T> {
  return metaGraphFetchJson<T>(url)
}
