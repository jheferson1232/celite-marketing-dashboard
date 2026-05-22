import { assertMetaEnvConfigured } from "./meta-env"
import { metaGraphFetchJson } from "./meta-graph-fetch"

export type MetaApiClient = {
  get: <T>(
    path: string,
    options?: { params?: Record<string, string> }
  ) => Promise<{ data: T }>
}

let metaClient: MetaApiClient | null = null

function buildMetaAccountUrl(
  accountId: string,
  path: string,
  params: Record<string, string>,
  token: string
): string {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path
  const url = new URL(
    `https://graph.facebook.com/v25.0/act_${accountId}/${normalizedPath}`
  )
  url.searchParams.set("access_token", token)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

export function getMetaClient(): MetaApiClient {
  if (!metaClient) {
    assertMetaEnvConfigured()

    const token = process.env.META_ACCESS_TOKEN!
    const accountId = process.env.META_AD_ACCOUNT_ID!

    metaClient = {
      async get<T>(
        path: string,
        options?: { params?: Record<string, string> }
      ): Promise<{ data: T }> {
        const url = buildMetaAccountUrl(
          accountId,
          path,
          options?.params ?? {},
          token
        )
        const data = await metaGraphFetchJson<T>(url)
        return { data }
      },
    }
  }

  return metaClient
}
