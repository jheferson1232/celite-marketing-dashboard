import prisma from "@/lib/prisma"
import { resolveMetaPageAccessList } from "./page-token"
import type {
  MetaCommentPageMonitoringState,
  MetaCommentPageReplyUpdate,
  MetaCommentReplyMode,
  MetaMonitoredPageConfig,
  MetaPageAccess,
} from "./types"

const VALID_REPLY_MODES = new Set<MetaCommentReplyMode>([
  "professional",
  "friendly",
  "concise",
])

function toPageConfig(row: {
  pageId: string
  pageName: string
  enabled: boolean
  replyMode: string
  replyTemplate: string | null
  websiteUrl: string | null
  updatedAt: Date
}): MetaMonitoredPageConfig {
  const replyMode = VALID_REPLY_MODES.has(row.replyMode as MetaCommentReplyMode)
    ? (row.replyMode as MetaCommentReplyMode)
    : "professional"

  return {
    pageId: row.pageId,
    pageName: row.pageName,
    enabled: row.enabled,
    replyMode,
    replyTemplate: row.replyTemplate,
    websiteUrl: row.websiteUrl,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Sincroniza catálogo de páginas desde Meta; nuevas entradas quedan habilitadas. */
export async function syncMetaCommentPageCatalog(): Promise<
  MetaMonitoredPageConfig[]
> {
  const pages = await resolveMetaPageAccessList()

  for (const page of pages) {
    await prisma.metaCommentPageConfig.upsert({
      where: { pageId: page.pageId },
      create: {
        pageId: page.pageId,
        pageName: page.pageName,
        enabled: true,
      },
      update: {
        pageName: page.pageName,
      },
    })
  }

  const rows = await prisma.metaCommentPageConfig.findMany({
    orderBy: { pageName: "asc" },
  })
  return rows.map(toPageConfig)
}

export async function listMetaCommentPageConfigs(): Promise<
  MetaMonitoredPageConfig[]
> {
  const existing = await prisma.metaCommentPageConfig.count()
  if (existing === 0) {
    return syncMetaCommentPageCatalog()
  }
  const rows = await prisma.metaCommentPageConfig.findMany({
    orderBy: { pageName: "asc" },
  })
  return rows.map(toPageConfig)
}

export async function getMetaCommentPageMonitoringState(): Promise<MetaCommentPageMonitoringState> {
  const configs = await listMetaCommentPageConfigs()
  const monitored = configs.filter((c) => c.enabled)
  const available = configs.filter((c) => !c.enabled)
  return { available, monitored }
}

export async function setMetaCommentPageEnabled(
  pageId: string,
  enabled: boolean
): Promise<MetaMonitoredPageConfig> {
  const row = await prisma.metaCommentPageConfig.update({
    where: { pageId },
    data: { enabled },
  })
  return toPageConfig(row)
}

export async function setAllMetaCommentPagesEnabled(
  enabled: boolean
): Promise<number> {
  const result = await prisma.metaCommentPageConfig.updateMany({
    data: { enabled },
  })
  return result.count
}

export async function updateMetaCommentPageReply(
  input: MetaCommentPageReplyUpdate
): Promise<MetaMonitoredPageConfig> {
  const data: {
    replyMode?: string
    replyTemplate?: string | null
    websiteUrl?: string | null
  } = {}

  if (input.replyMode !== undefined) {
    if (!VALID_REPLY_MODES.has(input.replyMode)) {
      throw new Error("Modo de respuesta no válido")
    }
    data.replyMode = input.replyMode
  }
  if (input.replyTemplate !== undefined) {
    data.replyTemplate = input.replyTemplate?.trim() || null
  }
  if (input.websiteUrl !== undefined) {
    data.websiteUrl = input.websiteUrl?.trim() || null
  }

  const row = await prisma.metaCommentPageConfig.update({
    where: { pageId: input.pageId },
    data,
  })
  return toPageConfig(row)
}

export async function getEnabledMetaPageAccessList(): Promise<MetaPageAccess[]> {
  const [pages, configs] = await Promise.all([
    resolveMetaPageAccessList(),
    listMetaCommentPageConfigs(),
  ])

  const enabledIds = new Set(
    configs.filter((c) => c.enabled).map((c) => c.pageId)
  )

  if (enabledIds.size === 0) {
    return pages
  }

  return pages.filter((p) => enabledIds.has(p.pageId))
}

export async function getPageConfigMap(): Promise<
  Map<string, MetaMonitoredPageConfig>
> {
  const configs = await listMetaCommentPageConfigs()
  return new Map(configs.map((c) => [c.pageId, c]))
}

export async function getMonitoredPageCount(): Promise<number> {
  return prisma.metaCommentPageConfig.count({ where: { enabled: true } })
}
