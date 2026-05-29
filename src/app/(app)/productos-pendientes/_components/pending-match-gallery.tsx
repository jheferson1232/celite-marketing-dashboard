"use client"

import { useCallback, useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  RiChat3Line,
  RiDeleteBinLine,
  RiDownloadLine,
  RiExternalLinkLine,
  RiHeartFill,
  RiHeartLine,
  RiPauseFill,
  RiPlayFill,
  RiStarFill,
  RiStarLine,
} from "@remixicon/react"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import type { PendingProductMatchRecord } from "@/lib/services/product-pending/types"
import {
  formatMatchCommentCount,
  formatMatchLikeCount,
  formatMatchPlayCount,
  parseMatchDisplay,
} from "@/lib/services/product-pending/parse-match-display"
import {
  deletePendingMatchAction,
  togglePendingMatchFavoriteAction,
} from "../_actions/pending-products"

function TikTokVideoMedia({
  coverUrl,
  videoUrl,
  isPlaying,
  onTogglePlay,
}: {
  coverUrl: string | null
  videoUrl: string | null
  isPlaying: boolean
  onTogglePlay: () => void
}) {
  const [coverFailed, setCoverFailed] = useState(false)
  const showVideo = isPlaying && Boolean(videoUrl)

  useEffect(() => {
    setCoverFailed(false)
  }, [coverUrl])

  if (showVideo) {
    return (
      <>
        <video
          key={videoUrl!}
          src={videoUrl!}
          poster={coverUrl ?? undefined}
          className="size-full object-cover"
          controls
          playsInline
          autoPlay
          onEnded={onTogglePlay}
        />
        <button
          type="button"
          onClick={onTogglePlay}
          className="absolute right-2 top-10 z-20 flex size-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
          aria-label="Detener reproducción"
        >
          <RiPauseFill className="size-4" />
        </button>
      </>
    )
  }

  return (
    <>
      {coverUrl && !coverFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          className="size-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-zinc-900 text-xs text-zinc-500">
          Sin miniatura
        </div>
      )}
      {videoUrl ? (
        <button
          type="button"
          onClick={onTogglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/40"
          aria-label="Reproducir video"
        >
          <span className="flex size-14 items-center justify-center rounded-full border-2 border-white/80 bg-black/45 text-white shadow-lg backdrop-blur-sm">
            <RiPlayFill className="size-7" />
          </span>
        </button>
      ) : null}
    </>
  )
}

function TikTokMatchCard({
  match,
  rank,
  isPlaying,
  isFavoritePending,
  isDeletePending,
  onTogglePlay,
  onToggleFavorite,
  onDelete,
}: {
  match: PendingProductMatchRecord
  rank: number
  isPlaying: boolean
  isFavoritePending: boolean
  isDeletePending: boolean
  onTogglePlay: () => void
  onToggleFavorite: () => void
  onDelete: () => void
}) {
  const info = parseMatchDisplay(match)
  const plays = formatMatchPlayCount(info)
  const likes = formatMatchLikeCount(info)
  const comments = formatMatchCommentCount(info)
  const caption = info.bodyText ?? info.title ?? "Sin descripción"
  const author = info.pageName ?? info.authorHandle ?? "TikTok"
  const matchPercent = Math.round(info.score * 100)

  return (
    <article className="group flex w-[220px] shrink-0 flex-col overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950 text-zinc-100 shadow-md transition-shadow hover:shadow-lg hover:shadow-violet-950/20">
      <div className="relative aspect-[9/16] w-full bg-zinc-900">
        <TikTokVideoMedia
          coverUrl={info.coverUrl}
          videoUrl={info.videoUrl}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
        />

        <button
          type="button"
          title={match.isFavorite ? "Quitar de favoritos" : "Marcar favorito"}
          disabled={isFavoritePending}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
          className={cn(
            "absolute left-2 top-2 z-20 flex size-8 items-center justify-center rounded-full border border-white/20 shadow-md transition-colors",
            match.isFavorite
              ? "bg-amber-500 text-zinc-950"
              : "bg-black/55 text-white hover:bg-amber-500 hover:text-zinc-950"
          )}
        >
          {match.isFavorite ? (
            <RiStarFill className="size-4" />
          ) : (
            <RiStarLine className="size-4" />
          )}
        </button>

        <span className="absolute right-2 top-2 z-20 rounded-md bg-violet-600 px-2 py-0.5 text-xs font-bold text-white shadow">
          #{rank}
        </span>

        <button
          type="button"
          title="Eliminar video"
          disabled={isDeletePending}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute right-2 top-11 z-20 flex size-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-destructive"
        >
          <RiDeleteBinLine className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2 bg-black p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-white">{author}</p>
          {matchPercent > 0 ? (
            <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
              {matchPercent}%
            </span>
          ) : null}
        </div>

        <p className="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-zinc-400">
          {caption}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-300">
          <span className="inline-flex items-center gap-1">
            <RiPlayFill className="size-3.5 text-zinc-500" />
            {plays ?? "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <RiHeartLine className="size-3.5 text-zinc-500" />
            {likes ?? "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <RiChat3Line className="size-3.5 text-zinc-500" />
            {comments ?? "0"}
          </span>
        </div>

        <div className="flex items-center gap-4 border-t border-zinc-800 pt-2 text-xs">
          {info.landingUrl ? (
            <a
              href={info.landingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-violet-400 transition-colors hover:text-violet-300"
            >
              Ver en TikTok
              <RiExternalLinkLine className="size-3.5" />
            </a>
          ) : null}
          {info.videoUrl ? (
            <a
              href={info.videoUrl}
              target="_blank"
              rel="noreferrer"
              download
              className="inline-flex items-center gap-1 text-zinc-400 transition-colors hover:text-white"
            >
              Descargar
              <RiDownloadLine className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function PendingMatchGallery({
  title,
  items,
}: {
  title: string
  items: PendingProductMatchRecord[]
}) {
  const queryClient = useQueryClient()
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [favoritePendingId, setFavoritePendingId] = useState<string | null>(null)
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null)

  const invalidateProducts = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["pending-products"] })
  }, [queryClient])

  const favoriteMutation = useMutation({
    mutationFn: (matchId: string) =>
      runServerAction(togglePendingMatchFavoriteAction(matchId)),
    onMutate: (matchId) => setFavoritePendingId(matchId),
    onSuccess: invalidateProducts,
    onSettled: () => setFavoritePendingId(null),
  })

  const deleteMutation = useMutation({
    mutationFn: (matchId: string) =>
      runServerAction(deletePendingMatchAction(matchId)),
    onMutate: (matchId) => {
      setDeletePendingId(matchId)
      if (playingId === matchId) setPlayingId(null)
    },
    onSuccess: invalidateProducts,
    onSettled: () => setDeletePendingId(null),
  })

  const handleTogglePlay = useCallback(
    (match: PendingProductMatchRecord) => {
      const info = parseMatchDisplay(match)
      if (!info.videoUrl) return

      setPlayingId((current) => (current === match.id ? null : match.id))
    },
    []
  )

  const handleDelete = useCallback(
    (match: PendingProductMatchRecord) => {
      if (
        !window.confirm(
          "¿Eliminar este video de los resultados? No se puede deshacer."
        )
      ) {
        return
      }
      deleteMutation.mutate(match.id)
    },
    [deleteMutation]
  )

  useEffect(() => {
    if (!playingId) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlayingId(null)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [playingId])

  if (items.length === 0) {
    return (
      <div>
        <p className="mb-2 text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">Sin resultados.</p>
      </div>
    )
  }

  const favoriteCount = items.filter((m) => m.isFavorite).length

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-sm font-medium">
          {title}{" "}
          <span className="text-muted-foreground font-normal">
            ({items.length}
            {favoriteCount > 0 ? ` · ${favoriteCount} favoritos` : ""})
          </span>
        </p>
        <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
          Haz clic en la miniatura para reproducir el video en la tarjeta. Usa{" "}
          <span className="text-foreground">Ver en TikTok</span> para abrirlo en
          la app o <span className="text-foreground">Descargar</span> para
          guardar el archivo.
        </p>
      </div>

      <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-gutter:stable]">
        <div className="flex w-max gap-4 pr-2">
          {items.map((match, index) => (
            <TikTokMatchCard
              key={match.id}
              match={match}
              rank={index + 1}
              isPlaying={playingId === match.id}
              isFavoritePending={favoritePendingId === match.id}
              isDeletePending={deletePendingId === match.id}
              onTogglePlay={() => handleTogglePlay(match)}
              onToggleFavorite={() => favoriteMutation.mutate(match.id)}
              onDelete={() => handleDelete(match)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
