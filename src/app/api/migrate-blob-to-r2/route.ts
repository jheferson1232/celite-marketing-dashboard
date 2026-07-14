import { NextResponse } from "next/server"
import {
  migrateBlobsToR2,
  rewriteDbUrls,
} from "@/lib/services/r2/migrate-from-vercel-blob"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type Phase = "copy" | "rewrite" | "all"

function parsePhase(value: string | null): Phase {
  if (value === "rewrite") return "rewrite"
  if (value === "all") return "all"
  return "copy"
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const phase = parsePhase(url.searchParams.get("phase"))
  const dryRun = url.searchParams.get("dryRun") === "1"
  const logs: string[] = []
  const onProgress = (msg: string) => {
    logs.push(msg)
    console.log(`[migrate-blob-to-r2] ${msg}`)
  }

  try {
    const result: Record<string, unknown> = { phase, dryRun }

    if (phase === "copy" || phase === "all") {
      // Sin persistMapPath: el mapa vive en memoria (Vercel tiene FS read-only).
      // Para reanudar localmente usá el script CLI, que sí lo persiste.
      const copy = await migrateBlobsToR2({ dryRun, onProgress })
      result.copy = {
        listed: copy.listed,
        copied: copy.copied,
        skippedExisting: copy.skippedExisting,
        errors: copy.errors,
      }
      if (phase === "all") {
        const rewrite = await rewriteDbUrls({
          map: copy.map,
          dryRun,
          onProgress,
        })
        result.rewrite = {
          scalarUpdated: rewrite.scalarUpdated,
          jsonUpdated: rewrite.jsonUpdated,
        }
      }
    } else if (phase === "rewrite") {
      return NextResponse.json(
        {
          error:
            "phase=rewrite no es válido en serverless (no hay FS persistente). Usá ?phase=all para copiar+reescribir en una sola petición.",
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true, ...result, logs })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error en migración"
    console.error("[migrate-blob-to-r2] fallo:", error)
    return NextResponse.json(
      { ok: false, error: message, logs },
      { status: 500 }
    )
  }
}

