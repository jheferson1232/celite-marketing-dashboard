"use client"

import { pickDisplayImageUrl } from "@/lib/services/meta/creative-media"
import { cn } from "@/lib/utils"

interface CreativePreviewImageProps {
  thumbnailUrl?: string
  imageUrl?: string
  alt: string
  className?: string
}

export function CreativePreviewImage({
  thumbnailUrl,
  imageUrl,
  alt,
  className,
}: CreativePreviewImageProps) {
  const src = pickDisplayImageUrl(thumbnailUrl, imageUrl)

  if (!src) return null

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("bg-muted object-cover", className)}
    />
  )
}
