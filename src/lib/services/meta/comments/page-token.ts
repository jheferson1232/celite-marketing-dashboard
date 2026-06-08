import { metaGraphErrorMessage } from "../meta-errors"
import { buildMetaGraphUrl, metaGraphFetchJson } from "../meta-graph-fetch"
import {
  META_PAGE_ACCESS_TOKEN_ENV,
  META_PAGE_ID_ENV,
} from "./env"
import type { MetaPageAccess } from "./types"

type MetaAccountsResponse = {
  data?: Array<{
    id: string
    name: string
    access_token?: string
  }>
}

/** Resuelve tokens de Página para leer/ocultar/responder comentarios. */
export async function resolveMetaPageAccessList(): Promise<MetaPageAccess[]> {
  const directToken = process.env[META_PAGE_ACCESS_TOKEN_ENV]?.trim()
  const directPageId = process.env[META_PAGE_ID_ENV]?.trim()

  if (directToken) {
    return [
      {
        pageId: directPageId ?? "configured-page",
        pageName: directPageId ? `Página ${directPageId}` : "Página configurada",
        accessToken: directToken,
      },
    ]
  }

  const url = buildMetaGraphUrl("me/accounts", {
    fields: "id,name,access_token",
    limit: "50",
  })
  const data = await metaGraphFetchJson<
    MetaAccountsResponse & { error?: { message?: string } }
  >(url)

  if (data.error?.message) {
    throw new Error(metaGraphErrorMessage(400, { error: data.error }))
  }

  return (data.data ?? [])
    .filter((page) => page.access_token)
    .map((page) => ({
      pageId: page.id,
      pageName: page.name,
      accessToken: page.access_token!,
    }))
}
