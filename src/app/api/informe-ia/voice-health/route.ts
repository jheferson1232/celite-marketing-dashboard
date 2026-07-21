import { NextResponse } from "next/server"
import axios from "axios"
import { mapOpenAiVoiceErrorMessage } from "@/lib/openai-voice-errors"

export const runtime = "nodejs"
export const maxDuration = 30

/** Diagnóstico rápido de Realtime (sin llamar a Meta). */
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
    const { data, status } = await axios.post<{
      value?: string
      error?: { message?: string; code?: string }
    }>(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        session: {
          type: "realtime",
          model: "gpt-realtime-2.1",
          instructions: "Responde solo: ok.",
          audio: { output: { voice: "marin" } },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": "celite-voice-health",
        },
        validateStatus: () => true,
      }
    )

    if (!data?.value) {
      const raw =
        data?.error?.message ||
        data?.error?.code ||
        `OpenAI HTTP ${status}`
      return NextResponse.json(
        {
          ok: false,
          keyPresent: true,
          keyLength: key.length,
          keyPrefix: key.slice(0, 7),
          error: mapOpenAiVoiceErrorMessage(String(raw)),
          rawError: String(raw).slice(0, 300),
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      keyPresent: true,
      keyLength: key.length,
      keyPrefix: key.slice(0, 7),
      model: "gpt-realtime-2.1",
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
