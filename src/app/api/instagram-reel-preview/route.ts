import { NextRequest, NextResponse } from "next/server"
import { proxiedInstagramMediaUrl } from "@/lib/instagram-media-url"
import {
  fetchInstagramReelMedia,
  instagramReelUrl,
  SociaVaultInsufficientCreditsError,
} from "@/lib/services/sociavault/instagram-reel-media"

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

  return NextResponse.json({
    shortcode: media.shortcode ?? shortcode,
    pageName: media.pageName,
    coverUrl: proxiedInstagramMediaUrl(media.coverUrl),
    videoUrl: proxiedInstagramMediaUrl(media.videoUrl),
    caption: media.caption,
    playCount: media.playCount,
  })
}
