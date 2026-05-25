"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiLoader4Line,
  RiRocketLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { runServerAction } from "@/lib/server-action"
import type { CampaignLaunchPreflightResult } from "@/lib/services/tiktok/launch-from-campaign"
import type { LaunchProgress } from "@/lib/services/tiktok/launch-progress"
import {
  getCampaignLaunchProgressAction,
  launchCampaignFromCampaignAction,
  previewLaunchFromCampaignAction,
} from "../_actions/campaigns"

type LaunchPhase = "loading" | "preview" | "launching" | "done" | "error"

interface CampaignLaunchDialogProps {
  campaignId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onLaunchSuccess?: () => void
}

const PROGRESS_POLL_MS = 750

function progressPercent(progress: LaunchProgress | null): number {
  if (!progress || progress.total <= 0) return 0
  return Math.min(100, Math.round((progress.current / progress.total) * 100))
}

export function CampaignLaunchDialog({
  campaignId,
  open,
  onOpenChange,
  onLaunchSuccess,
}: CampaignLaunchDialogProps) {
  const [phase, setPhase] = useState<LaunchPhase>("loading")
  const [preflight, setPreflight] = useState<CampaignLaunchPreflightResult | null>(
    null
  )
  const [launchProgress, setLaunchProgress] = useState<LaunchProgress | null>(
    null
  )
  const [resultMessage, setResultMessage] = useState("")
  const [error, setError] = useState("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopProgressPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startProgressPolling = useCallback(() => {
    stopProgressPolling()
    pollRef.current = setInterval(() => {
      void runServerAction(getCampaignLaunchProgressAction(campaignId))
        .then((progress) => {
          if (progress) setLaunchProgress(progress)
        })
        .catch(() => {
          // Ignorar errores de polling transitorios.
        })
    }, PROGRESS_POLL_MS)
  }, [campaignId, stopProgressPolling])

  const loadPreflight = useCallback(async () => {
    setPhase("loading")
    setError("")
    setResultMessage("")
    setLaunchProgress(null)
    try {
      const preview = await runServerAction(
        previewLaunchFromCampaignAction(campaignId)
      )
      if (!preview) throw new Error("Sin respuesta del servidor")
      setPreflight(preview)
      setPhase("preview")
    } catch (e) {
      setPreflight(null)
      setError(e instanceof Error ? e.message : "Error al verificar campaña")
      setPhase("error")
    }
  }, [campaignId])

  useEffect(() => {
    if (!open) return
    void loadPreflight()
  }, [open, loadPreflight])

  useEffect(() => {
    return () => stopProgressPolling()
  }, [stopProgressPolling])

  async function handleLaunch() {
    if (!preflight?.ready) return
    setPhase("launching")
    setError("")
    setLaunchProgress({
      campaignId,
      stage: "staging",
      current: 0,
      total: preflight.adGroupCount,
      message: "Iniciando publicación…",
      updatedAt: Date.now(),
    })
    startProgressPolling()

    try {
      const launchResult = await runServerAction(
        launchCampaignFromCampaignAction(campaignId)
      )
      if (!launchResult) throw new Error("Sin respuesta del servidor")
      setResultMessage(launchResult.message)
      setPhase("done")
      onLaunchSuccess?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al lanzar campaña")
      setPhase("preview")
    } finally {
      stopProgressPolling()
      const finalProgress = await runServerAction(
        getCampaignLaunchProgressAction(campaignId)
      ).catch(() => null)
      if (finalProgress) setLaunchProgress(finalProgress)
    }
  }

  function handleClose(nextOpen: boolean) {
    if (phase === "launching") return
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setPhase("loading")
      setPreflight(null)
      setLaunchProgress(null)
      setError("")
      setResultMessage("")
    }
  }

  const progressValue = progressPercent(launchProgress)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" showCloseButton={phase !== "launching"}>
        <DialogHeader>
          <DialogTitle>Lanzar campaña en TikTok</DialogTitle>
          <DialogDescription>
            Revisa el resumen y confirma la subida. Los videos se descargan desde
            los creativos en Blob.
          </DialogDescription>
        </DialogHeader>

        {phase === "loading" ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <RiLoader4Line className="size-4 animate-spin" />
            Verificando configuración…
          </div>
        ) : null}

        {phase === "preview" && preflight ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <p className="font-medium">{preflight.campaignName}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Estrategia {preflight.strategy}
              </p>
              <dl className="mt-3 grid gap-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Presupuesto/conjunto</dt>
                  <dd className="font-medium tabular-nums">
                    {preflight.dailyBudget} COP
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Conjuntos</dt>
                  <dd className="font-medium tabular-nums">
                    {preflight.adGroupCount}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Videos</dt>
                  <dd className="font-medium tabular-nums">
                    {preflight.videoCount}
                  </dd>
                </div>
              </dl>
              <p className="text-muted-foreground mt-2 truncate text-xs">
                Landing: {preflight.landingPageUrl}
              </p>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                Texto: {preflight.adText}
              </p>
            </div>

            {preflight.checks.some((c) => !c.ok) ? (
              <ul className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-sm">
                {preflight.checks
                  .filter((c) => !c.ok)
                  .map((c) => (
                    <li key={c.label} className="flex items-start gap-2">
                      <RiCloseCircleLine className="mt-0.5 size-4 shrink-0 text-destructive" />
                      <span>
                        <span className="font-medium">{c.label}</span>
                        {c.detail ? (
                          <span className="text-muted-foreground block text-xs">
                            {c.detail}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <RiCheckboxCircleLine className="size-4 shrink-0" />
                Lista para publicar — {preflight.adGroupCount} conjunto
                {preflight.adGroupCount === 1 ? "" : "s"}
              </p>
            )}

            {preflight.adgroups.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-lg border text-sm">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Conjunto</th>
                      <th className="px-3 py-2 text-left font-medium">Video</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preflight.adgroups.map((ag) => (
                      <tr key={ag.name} className="border-t">
                        <td className="px-3 py-2">{ag.name}</td>
                        <td className="text-muted-foreground px-3 py-2 text-xs">
                          {ag.videoLabel ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>
        ) : null}

        {phase === "launching" ? (
          <div className="text-muted-foreground flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <RiLoader4Line className="size-4 animate-spin" />
              {launchProgress?.message ?? "Publicando en TikTok…"}
            </div>
            {launchProgress && launchProgress.total > 0 ? (
              <div className="flex flex-col gap-1">
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-[width] duration-300"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
                <p className="text-xs tabular-nums">
                  {launchProgress.current}/{launchProgress.total} (
                  {progressValue}%)
                </p>
              </div>
            ) : (
              <p className="text-xs">Esto puede tardar varios minutos.</p>
            )}
          </div>
        ) : null}

        {phase === "done" ? (
          <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm">
            {resultMessage}
          </pre>
        ) : null}

        {phase === "error" ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : null}

        <DialogFooter>
          {phase === "preview" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadPreflight()}
              >
                Verificar de nuevo
              </Button>
              <Button
                type="button"
                className="gap-2"
                disabled={!preflight?.ready}
                onClick={() => void handleLaunch()}
              >
                <RiRocketLine className="size-4" />
                Confirmar subida a TikTok
              </Button>
            </>
          ) : null}
          {phase === "done" || phase === "error" ? (
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cerrar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
