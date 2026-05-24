"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiCloudLine,
  RiFolderLine,
  RiInformationLine,
  RiLoader4Line,
  RiRocketLine,
  RiUploadCloud2Line,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isCloudHosted } from "@/lib/deployment/cloud-host"
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import type { LaunchPreflightResult } from "@/lib/services/tiktok/launch-preflight"
import type { ProductRecord } from "@/lib/services/product"
import {
  getProductLaunchVideosDirPreferenceAction,
  launchFromProductAction,
  previewLaunchFromProductAction,
} from "../../_actions/launch-tiktok"

const VIDEOS_DIR_STORAGE_KEY = "tiktok-product-videos-dir"
const VIDEOS_DIR_PLACEHOLDER =
  "Ej: D:\\calzados\\tesla (solo desarrollo local con servidor en tu PC)"

type Phase = "prepare" | "launching" | "done" | "error"

function getStoredVideosDir(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(VIDEOS_DIR_STORAGE_KEY)?.trim() ?? ""
}

function storeVideosDir(dir: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(VIDEOS_DIR_STORAGE_KEY, dir)
  }
}

interface ProductTikTokLaunchPanelProps {
  product: ProductRecord
  onClose: () => void
  onLaunched?: () => void
}

export function ProductTikTokLaunchPanel({
  product,
  onClose,
  onLaunched,
}: ProductTikTokLaunchPanelProps) {
  const [phase, setPhase] = useState<Phase>("prepare")
  const [videosDir, setVideosDir] = useState("")
  const [showLocalFolder, setShowLocalFolder] = useState(false)
  const [preflight, setPreflight] = useState<LaunchPreflightResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState("")
  const [error, setError] = useState("")

  const blobVideoCount = product.videos.length
  const hasBlobVideos = blobVideoCount > 0
  const cloudHosted = isCloudHosted()
  const localFolderAllowed = !cloudHosted

  const runPreflight = useCallback(
    async (dir: string) => {
      setChecking(true)
      setError("")
      try {
        const preview = await runServerAction(
          previewLaunchFromProductAction({
            productId: product.id,
            videosDir: dir,
          })
        )
        if (!preview) throw new Error("Sin respuesta del servidor")
        setPreflight(preview)
      } catch (e) {
        setPreflight(null)
        setError(e instanceof Error ? e.message : "Error al verificar")
      } finally {
        setChecking(false)
      }
    },
    [product.id]
  )

  useEffect(() => {
    async function init() {
      if (hasBlobVideos) {
        setVideosDir("")
        setShowLocalFolder(false)
        void runPreflight("")
        return
      }

      if (cloudHosted) {
        setVideosDir("")
        setShowLocalFolder(false)
        void runPreflight("")
        return
      }

      const stored = getStoredVideosDir()
      if (stored) {
        setVideosDir(stored)
        setShowLocalFolder(true)
        void runPreflight(stored)
        return
      }
      try {
        const fromEnv = await runServerAction(
          getProductLaunchVideosDirPreferenceAction()
        )
        const dir = fromEnv?.trim() ?? ""
        setVideosDir(dir)
        setShowLocalFolder(Boolean(dir))
        void runPreflight(dir)
      } catch {
        void runPreflight("")
      }
    }
    void init()
  }, [runPreflight, hasBlobVideos, cloudHosted])

  function handleVideosDirChange(value: string) {
    setVideosDir(value)
    if (value.trim()) storeVideosDir(value)
  }

  function useBlobVideos() {
    setVideosDir("")
    setShowLocalFolder(false)
    void runPreflight("")
  }

  async function launch() {
    if (!preflight?.ready) return
    storeVideosDir(videosDir)
    setPhase("launching")
    setError("")
    try {
      const launchResult = await runServerAction(
        launchFromProductAction({
          productId: product.id,
          videosDir,
        })
      )
      if (!launchResult) throw new Error("Sin respuesta del servidor")
      setResult(launchResult.message)
      setPhase("done")
      onLaunched?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al lanzar campaña")
      setPhase("prepare")
    }
  }

  if (phase === "launching") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <div className="text-muted-foreground flex items-center gap-2">
          <RiLoader4Line className="size-4 animate-spin" />
          Publicando en TikTok… puede tardar varios minutos.
        </div>
        {videosDir ? (
          <p className="text-muted-foreground text-xs">
            Carpeta: <code className="text-[11px]">{videosDir}</code>
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Usando videos del producto (Blob).
          </p>
        )}
      </div>
    )
  }

  if (phase === "done" && result) {
    return (
      <div className="flex w-full flex-col gap-2">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm">
          {result}
        </pre>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    )
  }

  if (phase === "error") {
    return (
      <div className="flex flex-col gap-2 text-sm text-destructive">
        <p>{error}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setPhase("prepare")
              void runPreflight(videosDir)
            }}
          >
            Reintentar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    )
  }

  const landingCount = product.landingPages.length
  const usingBlob = hasBlobVideos && !videosDir.trim()

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-sm font-medium">{product.name}</p>
      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <RiInformationLine className="mt-0.5 size-3.5 shrink-0" />
        Usa presupuesto y landing pages del producto. Necesitas un JSON en{" "}
        <code className="text-[11px]">config/tiktok-campaigns</code> con el mismo
        nombre.
      </p>

      <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
        <p>
          <span className="font-medium">Presupuesto:</span>{" "}
          {product.budget > 0 ? `S/ ${product.budget}/día` : "Sin definir"}
        </p>
        <p>
          <span className="font-medium">Landing pages:</span>{" "}
          {landingCount > 0 ? landingCount : "Ninguna (se usan URLs del JSON)"}
        </p>
        <p>
          <span className="font-medium">Videos en producto:</span>{" "}
          {blobVideoCount > 0
            ? `${blobVideoCount} en Vercel Blob`
            : cloudHosted
              ? "Ninguno — súbelos en Editar producto"
              : "0"}
        </p>
      </div>

      {cloudHosted && !hasBlobVideos ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <RiUploadCloud2Line className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Sube videos al producto</p>
              <p className="text-muted-foreground text-xs">
                En Vercel no se puede usar una carpeta de tu PC. Los .mp4 se
                guardan en Vercel Blob al subirlos en la edición del producto
                (máx. 100 MB por video). Asegúrate de tener{" "}
                <code className="text-[11px]">BLOB_READ_WRITE_TOKEN</code> en el
                proyecto de Vercel.
              </p>
            </div>
          </div>
          <Button type="button" size="sm" className="w-fit gap-2" asChild>
            <Link href={`/products/${product.id}`} onClick={onClose}>
              <RiUploadCloud2Line className="size-4" />
              Ir a Editar producto → Videos
            </Link>
          </Button>
        </div>
      ) : null}

      {hasBlobVideos ? (
        <div
          className={cn(
            "flex flex-col gap-2 rounded-lg border p-3",
            usingBlob
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-muted bg-muted/30"
          )}
        >
          <div className="flex items-start gap-2">
            <RiCloudLine
              className={cn(
                "mt-0.5 size-4 shrink-0",
                usingBlob ? "text-emerald-700" : "text-muted-foreground"
              )}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">
                {usingBlob
                  ? `Videos del producto (${blobVideoCount})`
                  : "Usando carpeta local"}
              </p>
              <p className="text-muted-foreground text-xs">
                {usingBlob
                  ? `Se publica 1 conjunto por cada video (${blobVideoCount} video${blobVideoCount === 1 ? "" : "s"}). Con ${landingCount} landing page${landingCount === 1 ? "" : "s"}, todos los conjuntos usan esa URL (igual que Notion con varias URLs).`
                  : "Se ignoran los videos de Blob mientras haya una ruta de carpeta."}
              </p>
            </div>
          </div>
          {!usingBlob ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-fit text-xs"
              onClick={useBlobVideos}
            >
              Volver a usar videos del producto
            </Button>
          ) : localFolderAllowed && !showLocalFolder ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-fit gap-1.5 px-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowLocalFolder(true)}
            >
              <RiFolderLine className="size-3.5" />
              Usar carpeta local en su lugar
            </Button>
          ) : null}
        </div>
      ) : null}

      {localFolderAllowed && (!hasBlobVideos || showLocalFolder) ? (
        <div className="flex flex-col gap-1.5 rounded-lg border bg-muted/30 p-3">
          <label className="text-sm font-medium" htmlFor="product-videos-dir">
            {hasBlobVideos
              ? "Carpeta local (alternativa)"
              : "Carpeta de videos en tu PC"}
          </label>
          <Input
            id="product-videos-dir"
            value={videosDir}
            onChange={(e) => handleVideosDirChange(e.target.value)}
            onBlur={() => void runPreflight(videosDir)}
            placeholder={VIDEOS_DIR_PLACEHOLDER}
            className="font-mono text-sm"
          />
          <p className="text-muted-foreground text-xs">
            {hasBlobVideos
              ? "Solo en desarrollo local: archivos .mp4 en disco en lugar de Blob."
              : "Desarrollo local: ruta con .mp4, o sube videos al producto para Vercel."}
          </p>
        </div>
      ) : null}

      {checking ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <RiLoader4Line className="size-4 animate-spin" />
          Verificando…
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

          {preflight.ready ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <RiCheckboxCircleLine className="size-4 shrink-0" />
              Listo para publicar en TikTok
              {preflight.launchableAds > 0
                ? ` · ${preflight.launchableAds} conjunto(s)`
                : ""}
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
          onClick={() => void runPreflight(videosDir)}
          disabled={checking}
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
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  )
}
