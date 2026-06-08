import prisma from "@/lib/prisma"
import {
  META_PAGE_ACCESS_TOKEN_ENV,
  META_PAGE_ID_ENV,
} from "./env"
import type { MetaPageAccess } from "./types"

/**
 * Resuelve tokens de Página para leer/ocultar/responder comentarios.
 *
 * Prioridad:
 * 1. MetaFacebookConnection en BD (OAuth con usuario humano) — recomendado
 * 2. META_PAGE_ACCESS_TOKEN env (token directo de página, legacy)
 *
 * Ya NO usa me/accounts (META_ACCESS_TOKEN de ads) para acceso a páginas.
 * Los tokens de System User no tienen permisos de página por defecto.
 */
export async function resolveMetaPageAccessList(): Promise<MetaPageAccess[]> {
  // 1. Páginas conectadas via OAuth (BD)
  const oauthPages = await prisma.metaFacebookConnection.findMany({
    where: { connected: true },
    orderBy: { pageName: "asc" },
  })

  if (oauthPages.length > 0) {
    return oauthPages.map((p) => ({
      pageId: p.pageId,
      pageName: p.pageName,
      accessToken: p.accessToken,
    }))
  }

  // 2. Token directo de página (env — legacy)
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

  return []
}
