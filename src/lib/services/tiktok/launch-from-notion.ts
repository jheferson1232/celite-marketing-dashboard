import {
  getNotionCampaignDraftByPageId,
  listNotionCampaignDrafts,
  markNotionCampaignLaunched,
  type NotionCampaignDraft,
} from "@/lib/services/notion/campaigns"
import { notionDraftToLaunchDraft } from "./launch-draft"
import {
  formatLaunchCampaignMessage,
  launchTikTokCampaignFromLaunchDraft,
  previewLaunchFromDraft,
  type LaunchCampaignOptions,
  type LaunchCampaignSummary,
} from "./launch-orchestrator"
import type { LaunchPreflightResult } from "./launch-preflight"

export type LaunchFromNotionSummary = LaunchCampaignSummary & {
  notionPageId: string
}

export type LaunchFromNotionOptions = LaunchCampaignOptions

export async function previewLaunchFromNotionPage(
  pageId: string,
  videosDir: string
): Promise<LaunchPreflightResult> {
  const draft = await getNotionCampaignDraftByPageId(pageId)
  if (!draft) {
    throw new Error("No se encontró la página en Notion o no está en Borrador.")
  }
  return previewLaunchFromDraft(notionDraftToLaunchDraft(draft), videosDir)
}

export async function launchTikTokCampaignFromNotionPage(
  pageId: string,
  options: LaunchFromNotionOptions = {}
): Promise<{ message: string; summary: LaunchFromNotionSummary }> {
  const draft = await getNotionCampaignDraftByPageId(pageId)
  if (!draft) {
    throw new Error("No se encontró la página en Notion o no está en Borrador.")
  }

  const summary = await launchTikTokCampaignFromNotionDraft(draft, options)
  return {
    message: formatLaunchCampaignMessage(summary),
    summary,
  }
}

export async function launchTikTokCampaignFromNotionDraft(
  draft: NotionCampaignDraft,
  options: LaunchFromNotionOptions = {}
): Promise<LaunchFromNotionSummary> {
  const launchDraft = notionDraftToLaunchDraft(draft)
  const summary = await launchTikTokCampaignFromLaunchDraft(
    launchDraft,
    options,
    async (result) => {
      await markNotionCampaignLaunched(draft.pageId, {
        campaignId: result.campaignId,
        adGroupCount: result.adGroupCount,
      })
    }
  )

  return {
    ...summary,
    notionPageId: draft.pageId,
  }
}

/** @deprecated Usar launchTikTokCampaignFromNotionDraft */
export async function launchTikTokCampaignFromDraft(
  draft: NotionCampaignDraft,
  options: LaunchFromNotionOptions = {}
): Promise<LaunchFromNotionSummary> {
  return launchTikTokCampaignFromNotionDraft(draft, options)
}

export async function listNotionDraftsForPicker(): Promise<NotionCampaignDraft[]> {
  return listNotionCampaignDrafts()
}

export function formatNotionDraftPickerMessage(
  drafts: NotionCampaignDraft[]
): string {
  if (drafts.length === 0) {
    return "No hay campañas en **Borrador** en Notion."
  }
  const lines = drafts.map((d) => {
    const budget =
      d.dailyBudget != null ? `S/ ${d.dailyBudget}` : "sin presupuesto"
    const urls = d.urls.length > 0 ? `${d.urls.length} URL(s)` : "sin URLs"
    return `• **${d.name}** — ${budget} · ${urls}`
  })
  return `**Borradores en Notion (${drafts.length})**\n\n${lines.join("\n")}`
}
