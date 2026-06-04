"use client"

import Image from "next/image"
import { RiImageLine, RiPlayCircleLine, RiVideoLine } from "@remixicon/react"
import { formatCreativeAddedAt } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { CreativeRecord } from "@/lib/services/creative"

interface CreativeCardProps {
  creative: CreativeRecord
  selected?: boolean
  onSelect?: () => void
  onOpenPreview?: () => void
  className?: string
  previewClassName?: string
  showFooter?: boolean
}

export function CreativeCard({
  creative,
  selected,
  onSelect,
  onOpenPreview,
  className,
  previewClassName,
  showFooter = true,
}: CreativeCardProps) {
  const label = creative.name?.trim() || creative.url.split("/").pop() || "Creative"

  const handleClick = () => {
    if (onOpenPreview) {
      onOpenPreview()
      return
    }
    onSelect?.()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group flex min-w-0 w-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition",
        "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected && "border-primary ring-2 ring-primary/20",
        className
      )}
    >
      <div className={cn("relative aspect-square bg-muted", previewClassName)}>
        {creative.type === "image" ? (
          <Image
            src={creative.url}
            alt={label}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <>
            <video
              src={creative.url}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <RiPlayCircleLine className="size-10 text-white drop-shadow" />
            </div>
          </>
        )}

        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
          {creative.type === "image" ? (
            <RiImageLine className="size-3" />
          ) : (
            <RiVideoLine className="size-3" />
          )}
          {creative.type}
        </span>

        <span
          className="absolute bottom-2 left-2 right-2 rounded-md bg-black/60 px-2 py-1 text-center text-[10px] font-medium leading-tight text-white"
          title="Fecha y hora en que se agregó al Baúl"
        >
          {formatCreativeAddedAt(creative.createdAt)}
        </span>
      </div>

      {showFooter ? (
        <div className="min-w-0 space-y-1 p-3">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            {creative.variants.length}{" "}
            {creative.variants.length === 1 ? "variante" : "variantes"}
          </p>
        </div>
      ) : null}
    </button>
  )
}
