"use client"

import * as React from "react"
import { pickDisplayImageUrl } from "@/lib/services/meta/creative-media"
import { cn } from "@/lib/utils"
import { RiImageLine } from "@remixicon/react"

interface CreativePreviewImageProps {
  thumbnailUrl?: string
  imageUrl?: string
  alt: string
  className?: string
}

function buildSrcCandidates(thumbnailUrl?: string, imageUrl?: string): string[] {
  const raw = [imageUrl, thumbnailUrl].filter(Boolean) as string[]
  const upscaled = raw.map((url) => pickDisplayImageUrl(url, url))
  const unique = new Set<string>()
  for (const url of [...raw, ...upscaled]) {
    if (url.trim()) unique.add(url.trim())
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
