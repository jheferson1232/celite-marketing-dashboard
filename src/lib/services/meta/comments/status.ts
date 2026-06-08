import {
  getMissingMetaCommentAgentEnv,
  isAnthropicConfigured,
} from "./env"
import { getMonitoredPageCount } from "./page-config"
import { resolveMetaPageAccessList } from "./page-token"
import { isMetaEnvConfigured } from "../meta-env"
import { META_PAGE_ACCESS_TOKEN_ENV } from "./env"
import type { MetaCommentAgentStatus } from "./types"

export async function getMetaCommentAgentStatus(): Promise<MetaCommentAgentStatus> {
  const missing = getMissingMetaCommentAgentEnv()
  let pages: Awaited<ReturnType<typeof resolveMetaPageAccessList>> = []
  let pageResolveHint: string | null = null

  if (isMetaEnvConfigured()) {
    try {
      pages = await resolveMetaPageAccessList()
      if (
        pages.length === 0 &&
        !process.env[META_PAGE_ACCESS_TOKEN_ENV]?.trim()
      ) {
        pageResolveHint =
          "Meta no devolvió páginas en me/accounts. Verificá que el token tenga pages_show_list, pages_read_engagement y pages_manage_engagement."
      }
    } catch (error) {
      pages = []
      pageResolveHint =
        error instanceof Error
          ? error.message
          : "No se pudieron listar las páginas de Facebook"
    }
  }

  const pageTokenConfigured = Boolean(
    process.env[META_PAGE_ACCESS_TOKEN_ENV]?.trim() || pages.length > 0
  )

  if (!pageTokenConfigured && isMetaEnvConfigured()) {
    if (pageResolveHint?.toLowerCase().includes("expired")) {
      missing.push("META_ACCESS_TOKEN expirado — generá uno nuevo en Meta")
    } else {
      missing.push(
        "Acceso a páginas: META_PAGE_ACCESS_TOKEN o permisos pages_* en META_ACCESS_TOKEN"
      )
    }
  }

  let monitoredCount = 0
  if (pageTokenConfigured) {
    try {
      monitoredCount = await getMonitoredPageCount()
    } catch {
      monitoredCount = pages.length
    }
  }

  return {
    anthropicConfigured: isAnthropicConfigured(),
    metaConfigured: isMetaEnvConfigured(),
    pageTokenConfigured,
    pageCount: pages.length,
    pageNames: pages.map((p) => p.pageName),
    monitoredCount: monitoredCount || pages.length,
    missing: [...new Set(missing)],
    pageResolveHint,
  }
}
