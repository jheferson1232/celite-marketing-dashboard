"use client"

import Image from "next/image"
import { RiImageLine, RiPlayCircleLine } from "@remixicon/react"
import { cn } from "@/lib/utils"

interface ProductCoverVisualProps {
  coverImage: string | null
  coverVideo: string | null
  isLoading?: boolean
  alt: string
  className?: string
  sizes?: string
}

export function ProductCoverVisual({
  coverImage,
  coverVideo,
  isLoading = false,
  alt,
  className,
  sizes = "240px",
}: ProductCoverVisualProps) {
  if (coverImage) {
    return (
      <Image
        src={coverImage}
        alt={alt}
        fill
        className={cn("object-cover", className)}
        sizes={sizes}
        unoptimized
      />
    )
  }

  if (isLoading) {
    return (
      <div className="h-full w-full animate-pulse bg-muted-foreground/10" />
    )
  }

  if (coverVideo) {
    return (
      <video
        src={coverVideo}
        className={cn("h-full w-full object-cover", className)}
        muted
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    )
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
      <RiImageLine className="size-8 opacity-40" />
      <RiPlayCircleLine className="size-5 opacity-30" />
    </div>
  )
}
