"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { RiPlayFill } from "@remixicon/react"
import { CAMPAIGN_STATUS_VALUES } from "@/lib/campaigns/status"
import type { CampaignStatus } from "@/lib/campaigns/status"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getTikTokVideoSourceAction } from "@/app/(app)/dashboard/_actions/tiktok-video-source"
import { isTikTokMediaHostname } from "@/lib/services/sociavault/tiktok-media-hosts"
import {
  formatTikTokVideoCreateTime,
  isTikTokPostVideoAsset,
  type TikTokAdVideoAsset,
} from "@/lib/services/tiktok/ad-video-asset"
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import {
  listTikTokAdVideosAction,
  listTikTokPixelsAction,
  previewSparkAuthCodeAction,
} from "../_actions/campaigns"
import {
  CAMPAIGN_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_LABELS,
} from "../_lib/status-labels"

type TikTokPixelOption = {
  id: string
  name: string
  code: string | null
}

interface CampaignGeneralSectionProps {
  name: string
  status: CampaignStatus
  pixelId: string
  authCode: string
  selectedTikTokVideoIds: string[]
  disabled?: boolean
  onNameChange: (name: string) => void
  onStatusChange: (status: CampaignStatus) => void
  onPixelIdChange: (pixelId: string) => void
  onAuthCodeChange: (authCode: string) => void
  onSelectedTikTokVideoIdsChange: (videoIds: string[]) => void
}

function buildPixelOptions(
  pixels: TikTokPixelOption[],
  selectedPixelId: string
): TikTokPixelOption[] {
  const byId = new Map(pixels.map((pixel) => [pixel.id, pixel]))

  if (selectedPixelId && !byId.has(selectedPixelId)) {
    byId.set(selectedPixelId, {
      id: selectedPixelId,
      name: `Pixel guardado (${selectedPixelId.slice(-6)})`,
      code: null,
    })
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"))
}

function proxyTikTokMedia(url: string): string {
  return `/api/tiktok-thumbnail?url=${encodeURIComponent(url)}`
}

/** TikTok file API suele devolver duration en ms; valores chicos se tratan como segundos. */
function formatVideoDuration(durationMs: number | null): string | null {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null
  }

  const totalSeconds = Math.max(
    1,
    Math.round(durationMs >= 1000 ? durationMs / 1000 : durationMs)
  )
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function toPlayableUrl(url: string): string {
  try {
    if (isTikTokMediaHostname(new URL(url).hostname)) {
      return proxyTikTokMedia(url)
    }
  } catch {
    // keep raw url
  }
  return url
}

function TikTokAdVideoPreviewDialog({
  video,
  open,
  onOpenChange,
}: {
  video: TikTokAdVideoAsset | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const videoId = video?.id
  const cachedPreview = video?.previewUrl?.trim() || ""
  const isPost = video ? isTikTokPostVideoAsset(video) : false
  const dateLabel = video ? formatTikTokVideoCreateTime(video.createTime) : null
  const profileLabel =
    video?.profileName?.trim() ||
    (isPost ? video?.name : null) ||
    video?.name ||
    "Video TikTok"

  const {
    data: fetchedUrl,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["tiktok-ad-video-preview", videoId],
    queryFn: () => runServerAction(getTikTokVideoSourceAction(videoId!)),
    enabled: open && Boolean(videoId) && !cachedPreview,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const rawSource = cachedPreview || fetchedUrl || null
  const sourceUrl = rawSource ? toPlayableUrl(rawSource) : null
  const poster = video?.coverUrl ? proxyTikTokMedia(video.coverUrl) : undefined
  const durationLabel = formatVideoDuration(video?.durationMs ?? null)
  const loading = !cachedPreview && (isLoading || isFetching)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4 p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="truncate pr-8">
            {profileLabel}
          </DialogTitle>
          <DialogDescription>
            {[durationLabel ? `Duración ${durationLabel}` : null, dateLabel]
              .filter(Boolean)
              .join(" · ") || "Preview del creativo en la cuenta"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {loading ? (
            <Skeleton className="aspect-[9/16] w-full rounded-lg" />
          ) : isError || !sourceUrl ? (
            <div className="bg-muted flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 rounded-lg p-4">
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={poster}
                  alt=""
                  className="max-h-[55%] w-auto rounded-md object-contain opacity-80"
                />
              ) : null}
              <p className="text-muted-foreground text-center text-sm">
                {error instanceof Error
                  ? error.message
                  : "No se pudo cargar el video para reproducir."}
              </p>
            </div>
          ) : (
            <video
              key={sourceUrl}
              poster={poster}
              src={sourceUrl}
              controls
              autoPlay
              playsInline
              className="bg-muted aspect-[9/16] w-full rounded-lg object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CampaignGeneralSection({
  name,
  status,
  pixelId,
  authCode,
  selectedTikTokVideoIds,
  disabled = false,
  onNameChange,
  onStatusChange,
  onPixelIdChange,
  onAuthCodeChange,
  onSelectedTikTokVideoIdsChange,
}: CampaignGeneralSectionProps) {
  const [debouncedAuthCode, setDebouncedAuthCode] = useState(authCode.trim())
  const [previewVideo, setPreviewVideo] = useState<TikTokAdVideoAsset | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedAuthCode(authCode.trim())
    }, 450)
    return () => window.clearTimeout(timer)
  }, [authCode])

  const {
    data: pixels = [],
    isLoading: pixelsLoading,
    isError: pixelsError,
    error: pixelsErrorDetail,
  } = useQuery({
    queryKey: ["tiktok-pixels"],
    queryFn: () => runServerAction(listTikTokPixelsAction()),
    staleTime: 5 * 60 * 1000,
  })

  const sparkPreviewQuery = useQuery({
    queryKey: ["tiktok-spark-auth-preview", debouncedAuthCode],
    queryFn: () => runServerAction(previewSparkAuthCodeAction(debouncedAuthCode)),
    enabled: debouncedAuthCode.length >= 8,
    retry: false,
    staleTime: 60 * 1000,
  })

  const {
    data: tikTokVideos = [],
    isLoading: videosLoading,
    isError: videosError,
    error: videosErrorDetail,
  } = useQuery({
    queryKey: ["tiktok-spark-posts"],
    queryFn: () => runServerAction(listTikTokAdVideosAction()),
    staleTime: 2 * 60 * 1000,
  })

  const selectedTikTokSet = useMemo(
    () => new Set(selectedTikTokVideoIds),
    [selectedTikTokVideoIds]
  )

  const tikTokPostVideos = useMemo(() => {
    const posts = tikTokVideos.filter(isTikTokPostVideoAsset)
    const byId = new Map(posts.map((video) => [video.id, video]))

    for (const id of selectedTikTokVideoIds) {
      if (byId.has(id)) continue
      const fromList = tikTokVideos.find((video) => video.id === id)
      if (fromList) {
        byId.set(id, fromList)
        continue
      }
      byId.set(id, {
        id,
        name: "Seleccionado",
        profileName: null,
        itemId: null,
        identityId: null,
        identityType: null,
        coverUrl: null,
        previewUrl: null,
        durationMs: null,
        width: null,
        height: null,
        format: null,
        createTime: null,
      })
    }

    return [...byId.values()].sort((a, b) => {
      const aTime = a.createTime ?? ""
      const bTime = b.createTime ?? ""
      if (aTime && bTime && aTime !== bTime) return bTime.localeCompare(aTime)
      return (a.profileName ?? a.name).localeCompare(
        b.profileName ?? b.name,
        "es"
      )
    })
  }, [selectedTikTokVideoIds, tikTokVideos])

  function toggleTikTokVideo(videoId: string, checked: boolean) {
    if (checked) {
      if (selectedTikTokSet.has(videoId)) return
      onSelectedTikTokVideoIdsChange([...selectedTikTokVideoIds, videoId])
      return
    }
    onSelectedTikTokVideoIdsChange(
      selectedTikTokVideoIds.filter((id) => id !== videoId)
    )
  }

  const pixelOptions = useMemo(
    () => buildPixelOptions(pixels, pixelId),
    [pixelId, pixels]
  )

  useEffect(() => {
    if (pixelId || pixelOptions.length === 0) return
    onPixelIdChange(pixelOptions[0]!.id)
  }, [onPixelIdChange, pixelId, pixelOptions])

  const selectedPixel = pixelOptions.find((pixel) => pixel.id === pixelId)
  const coverUrl = sparkPreviewQuery.data?.coverUrl?.trim() || null

  return (
    <section className="max-w-2xl space-y-4 rounded-xl border bg-muted/10 p-4">
      <div>
        <h2 className="text-sm font-semibold">Información general</h2>
        <p className="text-xs text-muted-foreground">
          Nombre, pixel de TikTok Ads y estado de la campaña.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="campaign-name" className="text-sm font-medium">
          Nombre de la campaña
        </label>
        <Input
          id="campaign-name"
          value={name}
          disabled={disabled}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="campaign-tiktok-pixel" className="text-sm font-medium">
            Pixel de TikTok Ads
          </label>
          {pixelOptions.length > 0 ? (
            <span className="text-muted-foreground text-xs">
              {pixelOptions.length} pixel{pixelOptions.length === 1 ? "" : "es"} en la
              cuenta
            </span>
          ) : null}
        </div>
        {pixelsLoading ? (
          <p className="text-muted-foreground text-sm">Cargando pixels…</p>
        ) : pixelsError ? (
          <p className="text-sm text-destructive">
            {pixelsErrorDetail instanceof Error
              ? pixelsErrorDetail.message
              : "No se pudieron cargar los pixels"}
          </p>
        ) : pixelOptions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No hay pixels en la cuenta conectada.{" "}
            <Link
              href="/tiktok/cuentas"
              className="text-primary underline-offset-4 hover:underline"
            >
              Conectar cuenta
            </Link>
          </p>
        ) : (
          <select
            id="campaign-tiktok-pixel"
            className={cn(
              "border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            value={pixelId}
            disabled={disabled}
            onChange={(event) => onPixelIdChange(event.target.value)}
          >
            <option value="" disabled>
              Seleccioná un pixel
            </option>
            {pixelOptions.map((pixel) => (
              <option key={pixel.id} value={pixel.id}>
                {pixel.name}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-muted-foreground">
          {selectedPixel ? (
            <>
              <span className="text-foreground font-medium">{selectedPixel.name}</span>
              {" · "}
              ID {selectedPixel.id}
            </>
          ) : (
            "Seleccioná el pixel que recibe eventos de compra en tu landing."
          )}
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="campaign-status" className="text-sm font-medium">
          Status
        </label>
        <select
          id="campaign-status"
          className={cn(
            "border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          value={status}
          disabled={disabled}
          onChange={(event) => onStatusChange(event.target.value as CampaignStatus)}
        >
          {CAMPAIGN_STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {CAMPAIGN_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Estado actual:{" "}
          <span className={cn("font-medium", CAMPAIGN_STATUS_BADGE_CLASS[status])}>
            {CAMPAIGN_STATUS_LABELS[status]}
          </span>
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <label className="text-sm font-medium">
              Posts de TikTok
            </label>
            <p className="text-xs text-muted-foreground">
              Solo posts orgánicos autorizados (originales). Cada uno seleccionado
              crea un conjunto al lanzar.
            </p>
          </div>
          {tikTokPostVideos.length > 0 ? (
            <span className="text-muted-foreground text-xs">
              {selectedTikTokVideoIds.length}/{tikTokPostVideos.length}{" "}
              seleccionados
            </span>
          ) : null}
        </div>

        {videosLoading ? (
          <p className="text-muted-foreground text-sm">Cargando posts de TikTok…</p>
        ) : videosError ? (
          <p className="text-sm text-destructive">
            {videosErrorDetail instanceof Error
              ? videosErrorDetail.message
              : "No se pudieron cargar los posts de TikTok"}
          </p>
        ) : tikTokPostVideos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No hay posts orgánicos autorizados en la cuenta. Autorizá un post
            Spark desde TikTok Ads.
          </p>
        ) : (
          <div className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {tikTokPostVideos.map((video) => {
              const checked = selectedTikTokSet.has(video.id)
              const durationLabel = formatVideoDuration(video.durationMs)
              const dateLabel = formatTikTokVideoCreateTime(video.createTime)
              const profileLabel =
                video.profileName?.trim() || video.name || "TikTok Post"
              return (
                <div
                  key={video.id}
                  className={cn(
                    "relative flex flex-col gap-1.5 rounded-lg border p-2 transition-colors",
                    checked
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/40"
                  )}
                >
                  <div className="bg-muted relative aspect-[9/16] w-full overflow-hidden rounded-md">
                    {video.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={proxyTikTokMedia(video.coverUrl)}
                        alt={profileLabel}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
                        Sin cover
                      </div>
                    )}

                    {durationLabel ? (
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                        {durationLabel}
                      </span>
                    ) : null}

                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      aria-label={`Seleccionar post de ${profileLabel}`}
                      className={cn(
                        "absolute right-1.5 top-1.5 z-10 border-background bg-background/90 shadow-sm",
                        checked && "border-primary data-[state=checked]:bg-primary"
                      )}
                      onCheckedChange={(value) =>
                        toggleTikTokVideo(video.id, value === true)
                      }
                    />

                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute bottom-1.5 right-1.5 z-10 size-8 rounded-full shadow-sm"
                      aria-label={`Reproducir post de ${profileLabel}`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setPreviewVideo(video)
                      }}
                    >
                      <RiPlayFill className="size-4" />
                    </Button>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="truncate text-xs font-medium leading-snug">
                      @{profileLabel.replace(/^@/, "")}
                    </span>
                    {dateLabel ? (
                      <span className="text-muted-foreground text-[11px] tabular-nums">
                        {dateLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <TikTokAdVideoPreviewDialog
          video={previewVideo}
          open={previewVideo !== null}
          onOpenChange={(open) => {
            if (!open) setPreviewVideo(null)
          }}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="campaign-tiktok-auth-code" className="text-sm font-medium">
          Código de autorización TikTok
        </label>
        <Input
          id="campaign-tiktok-auth-code"
          value={authCode}
          disabled={disabled}
          autoComplete="off"
          placeholder="Código Spark Ads del video autorizado"
          onChange={(event) => onAuthCodeChange(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Pegá el código de autorización del post (Spark Ads). Se muestra la miniatura
          del video al reconocerlo.
        </p>

        {debouncedAuthCode.length >= 8 ? (
          <div className="flex items-start gap-3 rounded-lg border bg-background/80 p-3">
            <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-md">
              {sparkPreviewQuery.isFetching ? (
                <div className="text-muted-foreground flex size-full items-center justify-center text-[10px]">
                  …
                </div>
              ) : coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proxyTikTokMedia(coverUrl)}
                  alt="Miniatura del video autorizado"
                  className="size-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex size-full items-center justify-center px-1 text-center text-[10px]">
                  Sin cover
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {sparkPreviewQuery.isFetching ? (
                <p className="text-muted-foreground text-sm">Buscando video…</p>
              ) : sparkPreviewQuery.isError ? (
                <p className="text-sm text-destructive">
                  {sparkPreviewQuery.error instanceof Error
                    ? sparkPreviewQuery.error.message
                    : "No se pudo cargar la miniatura"}
                </p>
              ) : sparkPreviewQuery.data ? (
                <div className="flex flex-col gap-1">
                  <p className="truncate text-sm font-medium">
                    {sparkPreviewQuery.data.userName || "Video autorizado"}
                  </p>
                  {sparkPreviewQuery.data.itemId ? (
                    <p className="text-muted-foreground truncate text-xs">
                      Item {sparkPreviewQuery.data.itemId}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
