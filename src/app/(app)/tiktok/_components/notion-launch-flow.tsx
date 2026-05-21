"use client"

import { useCallback, useEffect, useState } from "react"
import {
  RiArrowRightSLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiInformationLine,
  RiLoader4Line,
  RiRocketLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { runServerAction } from "@/lib/server-action"
import type { LaunchPreflightResult } from "@/lib/services/tiktok/launch-preflight"
import {
  getVideosDirPreferenceAction,
  launchFromNotionAction,
  listNotionDraftsAction,
  previewLaunchFromNotionAction,
} from "../_actions/launch-from-notion"
import type { NotionCampaignDraft } from "@/lib/services/notion/campaigns"
import { cn } from "@/lib/utils"

export const NOTION_LAUNCH_SUGGESTION = "Lanzar campaña con Notion"

const VIDEOS_DIR_STORAGE_KEY = "tiktok-notion-videos-dir"
const VIDEOS_DIR_PLACEHOLDER = "Ej: D:\\calzados\\tesla"

type Phase = "loading" | "list" | "prepare" | "launching" | "done" | "error"

interface NotionLaunchFlowProps {
  onClose: () => void
  compact?: boolean
}

function getStoredVideosDir(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(VIDEOS_DIR_STORAGE_KEY)?.trim() ?? ""
}

function storeVideosDir(dir: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(VIDEOS_DIR_STORAGE_KEY, dir)
  }
}

export function NotionLaunchFlow({ onClose, compact }: NotionLaunchFlowProps) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [drafts, setDrafts] = useState<NotionCampaignDraft[]>([])
  const [selected, setSelected] = useState<NotionCampaignDraft | null>(null)
  const [videosDir, setVideosDir] = useState("")
  const [preflight, setPreflight] = useState<LaunchPreflightResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadVideosDirPreference() {
      const stored = getStoredVideosDir()
      if (stored) {
        setVideosDir(stored)
        return
      }
      try {
        const fromEnv = await runServerAction(getVideosDirPreferenceAction())
        if (fromEnv?.trim()) setVideosDir(fromEnv.trim())
      } catch {
        // sin valor por defecto
      }
    }
    void loadVideosDirPreference()
  }, [])

  const runPreflight = useCallback(async (pageId: string, dir: string) => {
    setChecking(true)
    setError("")
    try {
      const preview = await runServerAction(
        previewLaunchFromNotionAction({ pageId, videosDir: dir })
      )
      if (!preview) throw new Error("Sin respuesta del servidor")
      setPreflight(preview)
    } catch (e) {
      setPreflight(null)
      setError(e instanceof Error ? e.message : "Error al verificar")
    } finally {
      setChecking(false)
    }
  }, [])

  const goToPrepare = useCallback(
    (draft: NotionCampaignDraft) => {
      const dir = getStoredVideosDir()
      setSelected(draft)
      setVideosDir(dir)
      setPreflight(null)
      setPhase("prepare")
      void runPreflight(draft.pageId, dir)
    },
    [runPreflight]
  )

  const loadDrafts = useCallback(async () => {
    setPhase("loading")
    setError("")
    try {
      const list = await runServerAction(listNotionDraftsAction())
      const items = list ?? []
      setDrafts(items)
      if (items.length === 0) {
        setPhase("done")
        return
      }
      if (items.length === 1) {
        goToPrepare(items[0]!)
        return
      }
      setPhase("list")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al consultar Notion")
      setPhase("error")
    }
  }, [goToPrepare])

  useEffect(() => {
    void loadDrafts()
  }, [loadDrafts])

  function handleVideosDirChange(value: string) {
    setVideosDir(value)
    storeVideosDir(value)
  }

  function verifyAgain() {
    if (!selected) return
    void runPreflight(selected.pageId, videosDir)
  }

  async function launch() {
    if (!selected || !preflight?.ready) return
    storeVideosDir(videosDir)
    setPhase("launching")
    setError("")
    try {
      const launchResult = await runServerAction(
        launchFromNotionAction({
          pageId: selected.pageId,
          videosDir,
        })
      )
      if (!launchResult) throw new Error("Sin respuesta del servidor")
      setResult(launchResult.message)
      setPhase("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al lanzar campaña")
      setPhase("prepare")
    }
  }

  if (phase === "loading") {
    return (
      <div className={cn("flex flex-col gap-3", compact ? "w-full" : "max-w-md")}>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <RiLoader4Line className="size-4 animate-spin" />
          Consultando borradores en Notion…
        </div>
      </div>
    )
  }

  if (phase === "list" && drafts.length > 0) {
    return (
      <div className="flex w-full flex-col gap-3">
        <p className="text-sm font-medium">Borradores en Notion</p>
        <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
          <RiInformationLine className="mt-0.5 size-3.5 shrink-0" />
          Elige una campaña. En el siguiente paso indicas la carpeta de videos
          (ej. <code className="text-[11px]">D:\calzados\tesla</code>) y
          verificamos que los .mp4 existan.
        </p>
        <ul className="flex flex-col gap-1.5">
          {drafts.map((d) => (
            <li key={d.pageId}>
              <button
                type="button"
                onClick={() => goToPrepare(d)}
                className="hover:bg-muted/80 flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-left text-sm transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {d.dailyBudget != null ? `S/ ${d.dailyBudget}/día` : "Sin presupuesto"}
                    {d.urls.length > 0 ? ` · ${d.urls.length} URL(s)` : ""}
                  </span>
                </div>
                <RiArrowRightSLine className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    )
  }

  if (phase === "prepare" && selected) {
    return (
      <div className="flex w-full flex-col gap-3">
        <p className="text-sm font-medium">{selected.name}</p>

        <div className="flex flex-col gap-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <label className="text-sm font-medium" htmlFor="videos-dir">
            Carpeta de videos en tu PC
          </label>
          <Input
            id="videos-dir"
            value={videosDir}
            onChange={(e) => handleVideosDirChange(e.target.value)}
            onBlur={verifyAgain}
            placeholder={VIDEOS_DIR_PLACEHOLDER}
            className="text-sm font-mono"
          />
          <p className="text-muted-foreground text-xs">
            Escribe la ruta completa de la carpeta donde guardas los .mp4 de
            esta campaña. Se guarda en tu navegador para las próximas veces (cada
            campaña puede usar otra carpeta).
          </p>
        </div>

        {checking ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <RiLoader4Line className="size-4 animate-spin" />
            Verificando carpeta y archivos…
          </div>
        ) : preflight ? (
          <>
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
            ) : null}

            {preflight.launchableAds > 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <RiCheckboxCircleLine className="size-4 shrink-0" />
                {preflight.launchableAds} conjunto
                {preflight.launchableAds === 1 ? "" : "s"} — 1 video por conjunto
                {preflight.skippedAds > 0
                  ? ` · ${preflight.skippedAds} variante(s) sin video`
                  : ""}
              </p>
            ) : null}

            {preflight.variants.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border text-sm">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Variante
                      </th>
                      <th className="px-3 py-2 text-center font-medium">
                        Videos
                      </th>
                      <th className="px-3 py-2 text-left font-medium">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preflight.variants.map((v) => (
                      <tr key={v.urlSlug} className="border-t">
                        <td className="px-3 py-2">{v.variant}</td>
                        <td className="px-3 py-2 text-center">
                          {v.videoCount}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {v.urlSlug}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : preflight ? (
              <p className="text-muted-foreground text-sm">
                No hay videos en la carpeta para las URLs de Notion.
              </p>
            ) : null}
          </>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={verifyAgain}
            disabled={checking || !videosDir.trim()}
          >
            Verificar de nuevo
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => void launch()}
            disabled={checking || !preflight?.ready}
          >
            <RiRocketLine className="size-4" />
            Publicar en TikTok
          </Button>
          {drafts.length > 1 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelected(null)
                setPhase("list")
              }}
            >
              Atrás
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "launching") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <div className="text-muted-foreground flex items-center gap-2">
          <RiLoader4Line className="size-4 animate-spin" />
          Publicando en TikTok… subiendo videos y creando conjuntos (varios minutos).
        </div>
        <p className="text-muted-foreground text-xs">
          Carpeta: <code className="text-[11px]">{videosDir}</code>
        </p>
      </div>
    )
  }

  if (phase === "done" && result) {
    return (
      <div className="flex w-full flex-col gap-2">
        <pre className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm">
          {result}
        </pre>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    )
  }

  if (phase === "done" && drafts.length === 0) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>
          No hay campañas en <strong>Borrador</strong> en Notion.
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 text-sm text-destructive">
      <p>{error || "Error desconocido"}</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void loadDrafts()}>
          Reintentar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  )
}
