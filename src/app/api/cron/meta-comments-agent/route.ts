import { NextResponse } from "next/server"
import {
  isValidCronRequest,
  runMetaCommentAgentCron,
} from "@/lib/services/meta/comments/cron"

export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")

  if (!isValidCronRequest(authHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "1"

  try {
    const result = await runMetaCommentAgentCron({ dryRun })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("Meta comments agent cron:", error)
    const message =
      error instanceof Error
        ? error.message
        : "Error en cron agente comentarios Meta"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
