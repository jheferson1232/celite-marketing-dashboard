import "server-only"

import { ServerActionError } from "@/lib/server-action"
import { getTikTokRequestContext } from "./tiktok-api.server"

export type SparkAuthVideoPreview = {
  authCode: string
  itemId: string | null
  userName: string | null
  coverUrl: string | null
  videoUrl: string | null
}

type TtVideoInfoResponse = {
  item_info?: {
    item_id?: string | number
    user_info?: { user_name?: string; display_name?: string }
    video_info?: {
      video_cover_url?: string
      poster_url?: string
      url?: string
      preview_url?: string
    }
  }
  // Algunas cuentas/regiones anidan distinto
  video_cover_url?: string
  item_id?: string | number
}

function pickCover(data: TtVideoInfoResponse): string | null {
  const fromItem =
    data.item_info?.video_info?.video_cover_url?.trim() ||
    data.item_info?.video_info?.poster_url?.trim() ||
    null
  return fromItem || data.video_cover_url?.trim() || null
}

export async function getSparkVideoFromAuthCode(
  rawAuthCode: string
): Promise<SparkAuthVideoPreview> {
  const authCode = rawAuthCode.trim()
  if (!authCode) {
    throw new ServerActionError("Pegá el código de autorización de TikTok.")
  }

  const { client, advertiserId } = await getTikTokRequestContext()

  const { data } = await client.get<{ data?: TtVideoInfoResponse }>(
    "/tt_video/info/",
    {
      params: {
        advertiser_id: advertiserId,
        auth_code: authCode,
      },
    }
  )

  const payload = data.data ?? {}
  const item = payload.item_info
  const itemId = item?.item_id != null ? String(item.item_id) : payload.item_id != null
    ? String(payload.item_id)
    : null

  const coverUrl = pickCover(payload)
  if (!itemId && !coverUrl) {
    throw new ServerActionError(
      "TikTok no devolvió datos del video para ese código de autorización."
    )
  }

  return {
    authCode,
    itemId,
    userName:
      item?.user_info?.display_name?.trim() ||
      item?.user_info?.user_name?.trim() ||
      null,
    coverUrl,
    videoUrl:
      item?.video_info?.preview_url?.trim() ||
      item?.video_info?.url?.trim() ||
      null,
  }
}
