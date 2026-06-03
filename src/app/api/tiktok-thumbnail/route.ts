import { NextRequest, NextResponse } from "next/server"
import { isTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim()
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  if (!isTikTokMediaUrl(raw)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 })
  }

  try {
    const upstream = await fetch(raw, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://www.tiktok.com/",
        Accept: "image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(30_000),
      redirect: "follow",
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Upstream failed" },
        { status: upstream.status === 404 ? 404 : 502 }
      )
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg"
    const body = await upstream.arrayBuffer()

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 })
  }
}
