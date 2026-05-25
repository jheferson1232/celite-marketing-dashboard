"use client"

import Image from "next/image"
import { RiPlayCircleLine } from "@remixicon/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type CreativePreviewItem = {
  id: string
  url: string
  type: "image" | "video"
  name: string | null
}

interface CreativePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  creative: CreativePreviewItem | null
}

function getCreativeLabel(creative: CreativePreviewItem): string {
  return creative.name?.trim() || creative.url.split("/").pop() || "Creative"
}

const mediaClassName =
  "block h-auto max-h-[80vh] w-full max-w-[400px] object-contain"

export function CreativePreviewDialog({
  open,
  onOpenChange,
  creative,
}: CreativePreviewDialogProps) {
  if (!creative) return null

  const label = getCreativeLabel(creative)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-full max-w-[min(calc(100vw-2rem),448px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[448px]">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle className="truncate pr-8">{label}</DialogTitle>
          <DialogDescription className="truncate">
            {creative.type === "video" ? "Reproducción del video" : "Vista ampliada"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center overflow-y-auto bg-muted/20 p-4">
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border bg-background shadow-sm",
              "mx-auto w-full max-w-[400px]"
            )}
          >
            {creative.type === "image" ? (
              <Image
                src={creative.url}
                alt={label}
                width={400}
                height={400}
                className={mediaClassName}
                unoptimized
              />
            ) : (
              <>
                <video
                  key={creative.id}
                  src={creative.url}
                  className={mediaClassName}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                    <RiPlayCircleLine className="size-3" />
                    Video
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
