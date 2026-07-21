import { NextResponse } from "next/server"
import { createInformeRealtimeClientSecret } from "@/lib/services/meta/meta-informe-voice"
import { mapOpenAiVoiceErrorMessage } from "@/lib/openai-voice-errors"

export const runtime = "nodejs"
export const maxDuration = 60

/** Diagnóstico de voz Realtime (no expone la API key). */
export async function GET() {
  const key = process.env.OPENAI_API_KEY?.trim() ?? ""
  if (!key) {
    return NextResponse.json({
      ok: false,
      keyPresent: false,
      keyLength: 0,
      error: "OPENAI_API_KEY no está definida en este entorno de Vercel.",
    })
  }

  try {
    const session = await createInformeRealtimeClientSecret()
    return NextResponse.json({
      ok: true,
      keyPresent: true,
      keyLength: key.length,
      keyPrefix: key.slice(0, 7),
      model: session.model,
      date: session.date,
    })
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        keyPresent: true,
        keyLength: key.length,
        keyPrefix: key.slice(0, 7),
        error: mapOpenAiVoiceErrorMessage(raw),
        rawError: raw.slice(0, 300),
      },
      { status: 502 }
    )
  }
}
