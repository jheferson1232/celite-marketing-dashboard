"use client"

import * as React from "react"
import { pickDisplayImageUrl } from "@/lib/services/meta/creative-media"
import { isTikTokMediaUrl } from "@/lib/services/sociavault/tiktok-media-hosts"
import { cn } from "@/lib/utils"
import { RiImageLine } from "@remixicon/react"

interface CreativePreviewImageProps {
  thumbnailUrl?: string
  imageUrl?: string
  alt: string
  className?: string
}

/** TikTok CDN bloquea hotlinking; el proxy añade Referer correcto. */
function toDisplayableMediaUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith("/api/tiktok-thumbnail?")) return trimmed
  if (isTikTokMediaUrl(trimmed)) {
    return `/api/tiktok-thumbnail?url=${encodeURIComponent(trimmed)}`
  }
  return trimmed
}

function buildSrcCandidates(
  thumbnailUrl?: string,
  imageUrl?: string
): string[] {
  const raw = [imageUrl, thumbnailUrl].filter(Boolean) as string[]
  const upscaled = raw.map((url) => pickDisplayImageUrl(url, url))
  const unique = new Set<string>()
  for (const url of [...raw, ...upscaled]) {
    const displayable = toDisplayableMediaUrl(url)
    if (displayable) unique.add(displayable)
  }
  return [...unique]
}

export function CreativePreviewImage({
  thumbnailUrl,
  imageUrl,
  alt,
  className,
}: CreativePreviewImageProps) {
  const candidates = React.useMemo(
    () => buildSrcCandidates(thumbnailUrl, imageUrl),
    [thumbnailUrl, imageUrl]
  )
  const [candidateIndex, setCandidateIndex] = React.useState(0)
  const src = candidates[candidateIndex]

  React.useEffect(() => {
    setCandidateIndex(0)
  }, [thumbnailUrl, imageUrl])

  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className
        )}
      >
        <RiImageLine className="size-10" aria-hidden />
      </div>
    )
  }

  if (candidateIndex >= candidates.length) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className
        )}
      >
        <RiImageLine className="size-10" aria-hidden />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={cn("bg-muted object-cover", className)}
      onError={() => {
        setCandidateIndex((current) => current + 1)
      }}
    />
  )
}
