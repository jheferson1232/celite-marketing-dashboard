import { NextRequest, NextResponse } from "next/server"

const ALLOWED_HOST =
  /^([a-z0-9-]+\.)?(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim()
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 })
  }

  if (parsed.protocol !== "https:" || !ALLOWED_HOST.test(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 })
  }

  const range = request.headers.get("range")

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.instagram.com/",
        Accept: "image/*,video/*,*/*;q=0.8",
        ...(range ? { Range: range } : {}),
      },
      signal: AbortSignal.timeout(30_000),
      redirect: "follow",
    })

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: "Upstream failed" },
        { status: upstream.status === 404 ? 404 : 502 }
      )
    }

    const contentType =
      upstream.headers.get("content-type") ??
      (range ? "video/mp4" : "image/jpeg")
    const contentLength = upstream.headers.get("content-length")
    const contentRange = upstream.headers.get("content-range")
    const body = await upstream.arrayBuffer()

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Accept-Ranges": "bytes",
    }
    if (contentLength) headers["Content-Length"] = contentLength
    if (contentRange) headers["Content-Range"] = contentRange

    return new NextResponse(body, {
      status: upstream.status,
      headers,
    })
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 })
  }
}
