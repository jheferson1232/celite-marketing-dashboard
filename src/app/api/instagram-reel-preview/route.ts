import { NextRequest, NextResponse } from "next/server"
import { proxiedInstagramMediaUrl } from "@/lib/instagram-media-url"
import { isManagedMediaUrl } from "@/lib/services/blob/persist-remote-media"
import {
  fetchInstagramReelMedia,
  instagramReelUrl,
  SociaVaultInsufficientCreditsError,
} from "@/lib/services/sociavault/instagram-reel-media"
import { persistInstagramReelMedia } from "@/lib/services/sociavault/persist-instagram-reel-media"

const SHORTCODE_RE = /^[A-Za-z0-9_-]{5,32}$/

export async function GET(request: NextRequest) {
  const shortcode = request.nextUrl.searchParams
    .get("shortcode")
    ?.trim()

  if (!shortcode || !SHORTCODE_RE.test(shortcode)) {
    return NextResponse.json({ error: "Invalid shortcode" }, { status: 400 })
  }

  let media: Awaited<ReturnType<typeof fetchInstagramReelMedia>>
  try {
    media = await fetchInstagramReelMedia(
      instagramReelUrl(shortcode),
      shortcode
    )
  } catch (error) {
    if (error instanceof SociaVaultInsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "insufficient_credits",
          message:
            "Sin créditos SociaVault. Recarga en https://sociavault.com/dashboard para miniaturas y reproducción.",
        },
        { status: 402 }
      )
    }
    throw error
  }

  if (!media?.coverUrl && !media?.videoUrl) {
    return NextResponse.json(
      { error: "Preview not available" },
      { status: 404 }
    )
  }

  const stored = await persistInstagramReelMedia(media)

  const coverUrl = stored.coverUrl
    ? isManagedMediaUrl(stored.coverUrl)
      ? stored.coverUrl
      : proxiedInstagramMediaUrl(stored.coverUrl)
    : null
  const videoUrl = stored.videoUrl
    ? isManagedMediaUrl(stored.videoUrl)
      ? stored.videoUrl
      : proxiedInstagramMediaUrl(stored.videoUrl)
    : null

  return NextResponse.json({
    shortcode: stored.shortcode ?? shortcode,
    pageName: stored.pageName,
    coverUrl,
    videoUrl,
    caption: stored.caption,
    playCount: stored.playCount,
  })
}
