import { launchTikTokCampaignFromNotionPage } from "@/lib/services/tiktok/launch-from-notion"

export const maxDuration = 300

export async function POST(req: Request) {
  let pageId: string | undefined
  let videosDir: string | undefined
  try {
    const body = (await req.json()) as { pageId?: string; videosDir?: string }
    pageId = body.pageId?.trim()
    videosDir = body.videosDir?.trim()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  if (!pageId) {
    return Response.json({ error: "Falta pageId" }, { status: 400 })
  }

  try {
    const result = await launchTikTokCampaignFromNotionPage(pageId, { videosDir })
    return Response.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al lanzar campaña"
    return Response.json({ error: message }, { status: 500 })
  }
}
