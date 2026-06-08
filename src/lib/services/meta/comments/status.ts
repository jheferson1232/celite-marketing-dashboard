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

  if (isMetaEnvConfigured()) {
    try {
      pages = await resolveMetaPageAccessList()
    } catch {
      pages = []
    }
  }

  const pageTokenConfigured = Boolean(
    process.env[META_PAGE_ACCESS_TOKEN_ENV]?.trim() || pages.length > 0
  )

  if (!pageTokenConfigured && isMetaEnvConfigured()) {
    missing.push(
      "META_PAGE_ACCESS_TOKEN o permisos pages_read_engagement + pages_manage_engagement"
    )
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
  }
}
