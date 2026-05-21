"use server"

import { createServerAction } from "@/lib/server-action"
import {
  launchTikTokCampaignFromNotionPage,
  listNotionDraftsForPicker,
  previewLaunchFromNotionPage,
} from "@/lib/services/tiktok/launch-from-notion"
import { getDefaultVideosDirectory } from "@/lib/services/tiktok/video-path"

export const listNotionDraftsAction = createServerAction(async () => {
  return listNotionDraftsForPicker()
})

/** Carpeta sugerida desde .env (el usuario puede cambiarla en el formulario). */
export const getVideosDirPreferenceAction = createServerAction(async () => {
  return getDefaultVideosDirectory()
})

export const previewLaunchFromNotionAction = createServerAction(
  async (input: { pageId: string; videosDir: string }) => {
    return previewLaunchFromNotionPage(input.pageId, input.videosDir)
  }
)

export const launchFromNotionAction = createServerAction(
  async (input: { pageId: string; videosDir: string }) => {
    return launchTikTokCampaignFromNotionPage(input.pageId, {
      videosDir: input.videosDir,
    })
  }
)
