"use client"

import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import type { CreativeRow } from "@/lib/services/meta/types"
import { getAdVideoSource } from "../../_actions/ad-video-source"
import { getCreativeVideoSource } from "../../_actions/creative-video-source"
import { CreativePreviewImage } from "./creative-preview-image"

interface CreativePreviewDialogProps {
  creative: CreativeRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  const msg = error.message.toLowerCase()
  if (
    msg.includes("demasiadas llamadas") ||
    msg.includes("rate limit") ||
    msg.includes("request limit")
  ) {
    return "Meta limitó las solicitudes. Espera 1–2 minutos y vuelve a intentar."
  }
  return null
}

export function CreativePreviewDialog({
  creative,
  open,
  onOpenChange,
}: CreativePreviewDialogProps) {
  const adId = creative?.adId
  const videoId = creative?.videoId
  const cachedVideoUrl = creative?.videoUrl?.trim() || ""
  const isVideo = creative?.mediaType === "video"
  const needsFetch = isVideo && !cachedVideoUrl && Boolean(videoId || adId)

  const {
    data: fetchedMedia,
    isLoading,
    isError,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["video-preview", videoId, adId],
    queryFn: async () => {
      if (videoId) {
        const fromVideoId = await runServerAction(
          getCreativeVideoSource(videoId)
        )
        if (fromVideoId) {
          return { sourceUrl: fromVideoId, embedUrl: null as string | null }
        }
      }

      if (adId) {
        return runServerAction(getAdVideoSource(adId))
      }

      return { sourceUrl: null, embedUrl: null }
    },
    enabled: open && needsFetch,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, err) => {
      if (getErrorMessage(err)) return false
      return failureCount < 1
    },
  })

  if (!creative) {
    return null
  }

  const videoSourceUrl = cachedVideoUrl || fetchedMedia?.sourceUrl
  const embedUrl = fetchedMedia?.embedUrl
  const rateLimitMessage = isError ? getErrorMessage(error) : null
  const imageUrl = creative.imageUrl || creative.thumbnailUrl
  const playbackKey = `${creative.id}:${videoSourceUrl ?? embedUrl ?? "empty"}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4 p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="truncate pr-8">{creative.name}</DialogTitle>
          <DialogDescription>
            {creative.mediaType === "video" ? "Video" : "Imagen"} del creativo
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {creative.mediaType === "video" ? (
            <VideoPreview
              key={playbackKey}
              isLoading={needsFetch && (isLoading || isFetching)}
              isError={isError}
              errorMessage={rateLimitMessage}
              poster={creative.imageUrl || creative.thumbnailUrl}
              sourceUrl={videoSourceUrl}
              embedUrl={embedUrl}
            />
          ) : imageUrl ? (
            <CreativePreviewImage
              thumbnailUrl={creative.thumbnailUrl}
              imageUrl={creative.imageUrl}
              alt={creative.name}
              className="aspect-9/16 w-full rounded-lg object-contain"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay preview disponible para este creativo.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface VideoPreviewProps {
  isLoading: boolean
  isError: boolean
  errorMessage?: string | null
  poster?: string
  sourceUrl?: string | null
  embedUrl?: string | null
}

function VideoPreview({
  isLoading,
  isError,
  errorMessage,
  poster,
  sourceUrl,
  embedUrl,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !sourceUrl) return

    video.pause()
    video.removeAttribute("src")
    video.load()
    video.src = sourceUrl
    video.load()
    void video.play().catch(() => undefined)

    return () => {
      video.pause()
      video.removeAttribute("src")
      video.load()
    }
  }, [sourceUrl])

  if (isLoading) {
    return <Skeleton className="aspect-9/16 w-full rounded-lg" />
  }

  if (embedUrl) {
    return (
      <iframe
        src={embedUrl}
        title="Preview del anuncio"
        className="aspect-9/16 w-full rounded-lg border-0 bg-muted"
        allow="autoplay; encrypted-media"
        scrolling="yes"
      />
    )
  }

  if (isError || !sourceUrl) {
    return (
      <div className="flex aspect-9/16 w-full flex-col items-center justify-center gap-3 rounded-lg bg-muted p-4">
        {poster ? (
          <img
            src={poster}
            alt=""
            className="max-h-[55%] w-auto rounded-md object-contain opacity-80"
          />
        ) : null}
        <p className="text-center text-sm text-muted-foreground">
          {errorMessage ??
            (isError
              ? "No se pudo cargar el video."
              : "No hay URL de video directa. Usa el preview de Meta o revisa permisos del token.")}
        </p>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      poster={poster}
      src={sourceUrl}
      controls
      autoPlay
      playsInline
      className="aspect-9/16 w-full rounded-lg bg-muted object-contain"
    />
  )
}
