"use client"

import { useEffect, useRef, useState } from "react"
import { RiMicLine, RiMicOffLine, RiLoader4Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import { createInformeVoiceSessionAction } from "../_actions/informe-voice"

type VoiceStatus = "idle" | "connecting" | "live" | "error"

type RealtimeEvent = {
  type?: string
  delta?: string
  transcript?: string
  error?: { message?: string }
}

function pickTranscript(event: RealtimeEvent): {
  role: "user" | "assistant"
  text: string
  final?: boolean
} | null {
  const type = event.type ?? ""
  if (
    type === "response.output_audio_transcript.delta" ||
    type === "response.audio_transcript.delta"
  ) {
    return event.delta ? { role: "assistant", text: event.delta } : null
  }
  if (
    type === "response.output_audio_transcript.done" ||
    type === "response.audio_transcript.done"
  ) {
    return event.transcript
      ? { role: "assistant", text: event.transcript, final: true }
      : null
  }
  if (type === "conversation.item.input_audio_transcription.completed") {
    return event.transcript
      ? { role: "user", text: event.transcript, final: true }
      : null
  }
  return null
}

export function InformeVoicePanel() {
  const [status, setStatus] = useState<VoiceStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [userLine, setUserLine] = useState("")
  const [assistantLine, setAssistantLine] = useState("")

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const cleanup = () => {
    dcRef.current?.close()
    dcRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioRef.current) {
      audioRef.current.srcObject = null
    }
  }

  useEffect(() => {
    return () => cleanup()
  }, [])

  const stop = () => {
    cleanup()
    setStatus("idle")
    setError(null)
  }

  const start = async () => {
    setError(null)
    setUserLine("")
    setAssistantLine("")
    setStatus("connecting")

    try {
      const session = await runServerAction(createInformeVoiceSessionAction())
      if (!session?.value) {
        throw new Error("No se recibió token de sesión de voz")
      }
      const ephemeralKey = session.value

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const audioEl = audioRef.current ?? document.createElement("audio")
      audioEl.autoplay = true
      audioRef.current = audioEl
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0]
      }

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = ms
      for (const track of ms.getTracks()) {
        pc.addTrack(track, ms)
      }

      const dc = pc.createDataChannel("oai-events")
      dcRef.current = dc

      dc.addEventListener("message", (e) => {
        try {
          const event = JSON.parse(String(e.data)) as RealtimeEvent
          if (event.type === "error" || event.type === "response.failed") {
            setError(event.error?.message || "Error en la sesión de voz")
            return
          }
          if (event.type === "response.created") {
            setAssistantLine("")
            return
          }
          const piece = pickTranscript(event)
          if (!piece) return
          if (piece.role === "user") {
            setUserLine(piece.text)
          } else if (piece.final) {
            setAssistantLine(piece.text)
          } else {
            setAssistantLine((prev) => prev + piece.text)
          }
        } catch {
          // ignore non-JSON
        }
      })

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp ?? "",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
        }
      )

      if (!sdpResponse.ok) {
        const body = await sdpResponse.text()
        throw new Error(
          body.trim() ||
            `No se pudo conectar a Realtime (${sdpResponse.status})`
        )
      }

      const answerSdp = await sdpResponse.text()
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })

      setStatus("live")
      setAssistantLine(
        "Conectado. Pregunta por críticos ON, CPA o gasto de hoy."
      )
    } catch (err) {
      cleanup()
      setStatus("error")
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo iniciar la voz del informe"
      )
    }
  }

  const busy = status === "connecting"
  const live = status === "live"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {live ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={stop}
            className="gap-1.5"
          >
            <RiMicOffLine className="size-4" />
            Cortar voz
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void start()}
            disabled={busy}
            className="gap-1.5"
          >
            {busy ? (
              <RiLoader4Line className="size-4 animate-spin" />
            ) : (
              <RiMicLine className="size-4" />
            )}
            {busy ? "Conectando…" : "Hablar del informe"}
          </Button>
        )}
        <span
          className={cn(
            "text-[11px]",
            live
              ? "font-medium text-green-700 dark:text-green-400"
              : "text-muted-foreground"
          )}
        >
          {live
            ? "Escuchando · solo consulta"
            : "Voz ChatGPT · consulta el informe"}
        </span>
      </div>

      {error ? (
        <p className="text-destructive max-w-md text-xs">{error}</p>
      ) : null}

      {live || userLine || assistantLine ? (
        <div className="bg-muted/20 max-w-xl rounded-md border px-2.5 py-2 text-xs">
          {userLine ? (
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">Tú: </span>
              {userLine}
            </p>
          ) : null}
          {assistantLine ? (
            <p className={cn(userLine && "mt-1")}>
              <span className="text-foreground font-medium">Asistente: </span>
              {assistantLine}
            </p>
          ) : null}
        </div>
      ) : null}

      <audio ref={audioRef} className="hidden" autoPlay />
    </div>
  )
}
