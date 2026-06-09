"use client"

import Image from "next/image"
import {
  RiCalendarLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiPlayFill,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { FacebookAdLibraryAd } from "@/lib/services/sociavault/facebook-ad-library"
import {
  facebookAdLibraryUrl,
  formatAdDateRange,
  getAdDaysActive,
} from "@/lib/services/meta/library/meta-library-analytics"

export function MetaLibraryAdCard({ ad }: { ad: FacebookAdLibraryAd }) {
  const days = getAdDaysActive(ad)
  const libraryUrl = facebookAdLibraryUrl(ad.adArchiveId)
  const linkUrl = ad.linkUrl ?? libraryUrl

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className={`size-2 rounded-full ${
              ad.isActive ? "bg-emerald-500" : "bg-muted-foreground"
            }`}
          />
          <span className="font-medium">
            {days}d {ad.isActive ? "Activo" : "Inactivo"}
          </span>
        </div>
        <div className="text-muted-foreground flex items-center gap-1">
          <RiCalendarLine className="size-3.5" />
          <span className="truncate">{formatAdDateRange(ad)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {ad.pageImageUrl ? (
            <Image
              src={ad.pageImageUrl}
              alt=""
              width={24}
              height={24}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <div className="bg-muted size-6 rounded-full" />
          )}
          <span className="truncate text-xs font-medium">
            {ad.pageName ?? "Página"}
          </span>
        </div>
        {ad.collationCount && ad.collationCount > 1 ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <RiFileCopyLine className="size-3" />
            {ad.collationCount}
          </Badge>
        ) : null}
      </div>

      <div className="relative mx-3 aspect-[4/5] overflow-hidden rounded-lg bg-muted">
        {ad.imageUrl ? (
          <Image
            src={ad.imageUrl}
            alt={ad.title ?? "Anuncio"}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
            Sin creativo
          </div>
        )}
        {ad.videoUrl ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <RiPlayFill className="size-12 text-white drop-shadow" />
          </div>
        ) : null}
      </div>

      <div className="m-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
        <p className="text-muted-foreground mb-1">Enlace de anuncios</p>
        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary line-clamp-2 inline-flex items-start gap-1 break-all hover:underline"
        >
          {linkUrl}
          <RiExternalLinkLine className="mt-0.5 size-3 shrink-0" />
        </a>
      </div>

      <div className="mt-auto border-t p-3">
        <Button type="button" variant="outline" className="w-full" asChild>
          <a href={libraryUrl} target="_blank" rel="noopener noreferrer">
            Análisis del anuncio
          </a>
        </Button>
      </div>
    </article>
  )
}
