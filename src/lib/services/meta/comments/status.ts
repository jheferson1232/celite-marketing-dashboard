import prisma from "@/lib/prisma"
import { isAnthropicConfigured } from "./env"
import { getMonitoredPageCount } from "./page-config"
import { isMetaEnvConfigured } from "../meta-env"
import type { MetaCommentAgentStatus } from "./types"

export async function getMetaCommentAgentStatus(): Promise<MetaCommentAgentStatus> {
  // Solo Anthropic es requerido en status.
  // Meta Ads y páginas de Facebook se configuran por separado (OAuth / env).
  const missing: string[] = []
  if (!isAnthropicConfigured()) missing.push("ANTHROPIC_API_KEY")

  // Contar páginas OAuth conectadas en BD (independiente del token de ads)
  let oauthPageCount = 0
  let pageNames: string[] = []
  try {
    const oauthPages = await prisma.metaFacebookConnection.findMany({
      where: { connected: true },
      select: { pageName: true },
      orderBy: { pageName: "asc" },
    })
    oauthPageCount = oauthPages.length
    pageNames = oauthPages.map((p) => p.pageName)
  } catch {
    oauthPageCount = 0
  }

  const oauthConnected = oauthPageCount > 0

  // "Páginas activas" = solo OAuth; NO se usa me/accounts para status
  const pageTokenConfigured = oauthConnected

  let monitoredCount = 0
  if (pageTokenConfigured) {
    try {
      monitoredCount = await getMonitoredPageCount()
    } catch {
      monitoredCount = oauthPageCount
    }
  }

  // Solo marcar como faltante Anthropic y Meta Ads; páginas se gestionan via UI
  return {
    anthropicConfigured: isAnthropicConfigured(),
    metaConfigured: isMetaEnvConfigured(),
    pageTokenConfigured,
    oauthConnected,
    oauthPageCount,
    pageCount: oauthPageCount,
    pageNames,
    monitoredCount: monitoredCount || oauthPageCount,
    missing: [...new Set(missing)],
    pageResolveHint: null,
  }
}
