"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import {
  RiCloseLine,
  RiImageAddLine,
  RiPlayCircleLine,
  RiUploadCloud2Line,
  RiVideoAddLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif"
const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime"
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

export type LocalMediaItem = {
  id: string
  file: File
  previewUrl: string
  kind: "image" | "video"
}

export type ProductMediaPickerMode = "all" | "images" | "videos"

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateLocalFile(file: File, kind: "image" | "video"): string | null {
  const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES
  const allowedPrefix = kind === "image" ? "image/" : "video/"

  if (!file.type.startsWith(allowedPrefix)) {
    return `${file.name}: tipo no permitido`
  }

  if (file.size > maxBytes) {
    return `${file.name}: supera ${formatBytes(maxBytes)}`
  }

  return null
}

interface ProductMediaPickerProps {
  mode?: ProductMediaPickerMode
  existingImages: string[]
  existingVideos: string[]
  localItems: LocalMediaItem[]
  onLocalItemsChange: (items: LocalMediaItem[]) => void
  onExistingImagesChange: (urls: string[]) => void
  onExistingVideosChange: (urls: string[]) => void
  disabled?: boolean
}

export function ProductMediaPicker({
  mode = "all",
  existingImages,
  existingVideos,
  localItems,
  onLocalItemsChange,
  onExistingImagesChange,
  onExistingVideosChange,
  disabled = false,
}: ProductMediaPickerProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const showImages = mode === "all" || mode === "images"
  const showVideos = mode === "all" || mode === "videos"

  const localImages = localItems.filter((item) => item.kind === "image")
  const localVideos = localItems.filter((item) => item.kind === "video")

  const addFiles = (files: FileList | null, kind: "image" | "video") => {
    if (!files?.length) return

    const nextItems = [...localItems]
    const errors: string[] = []

    for (const file of Array.from(files)) {
      const validationError = validateLocalFile(file, kind)
      if (validationError) {
        errors.push(validationError)
        continue
      }

      nextItems.push({
        id: `${kind}-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        kind,
      })
    }

    if (errors.length > 0) setError(errors.join(" · "))
    else setError(null)

    onLocalItemsChange(nextItems)
  }

  const removeLocalItem = (id: string) => {
    const target = localItems.find((item) => item.id === id)
    if (target) URL.revokeObjectURL(target.previewUrl)
    onLocalItemsChange(localItems.filter((item) => item.id !== id))
  }

  const removeExistingImage = (url: string) => {
    onExistingImagesChange(existingImages.filter((item) => item !== url))
  }

  const removeExistingVideo = (url: string) => {
    onExistingVideosChange(existingVideos.filter((item) => item !== url))
  }

  const hasImages = existingImages.length > 0 || localImages.length > 0
  const hasVideos = existingVideos.length > 0 || localVideos.length > 0
  const hasMedia =
    mode === "images"
      ? hasImages
      : mode === "videos"
        ? hasVideos
        : hasImages || hasVideos

  const emptyLabel =
    mode === "images"
      ? "Sin imágenes seleccionadas"
      : mode === "videos"
        ? "Sin videos seleccionados"
        : "Sin archivos seleccionados"

  return (
    <div className="space-y-4">
      {(showImages || showVideos) && (
        <div
          className={cn(
            "grid gap-2",
            showImages && showVideos ? "sm:grid-cols-2" : "grid-cols-1"
          )}
        >
          {showImages ? (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="hidden"
                disabled={disabled}
                onChange={(event) => {
                  addFiles(event.target.files, "image")
                  event.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-2 py-3"
                disabled={disabled}
                onClick={() => imageInputRef.current?.click()}
              >
                <RiImageAddLine className="size-4 shrink-0" />
                <span className="text-left">
                  <span className="block text-sm font-medium">Añadir imágenes</span>
                  <span className="block text-xs text-muted-foreground">
                    JPG, PNG, WebP · máx. 10 MB
                  </span>
                </span>
              </Button>
            </>
          ) : null}

          {showVideos ? (
            <>
              <input
                ref={videoInputRef}
                type="file"
                accept={VIDEO_ACCEPT}
                multiple
                className="hidden"
                disabled={disabled}
                onChange={(event) => {
                  addFiles(event.target.files, "video")
                  event.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-2 py-3"
                disabled={disabled}
                onClick={() => videoInputRef.current?.click()}
              >
                <RiVideoAddLine className="size-4 shrink-0" />
                <span className="text-left">
                  <span className="block text-sm font-medium">Añadir videos</span>
                  <span className="block text-xs text-muted-foreground">
                    MP4, WebM · máx. 100 MB
                  </span>
                </span>
              </Button>
            </>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!hasMedia ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center">
          <RiUploadCloud2Line className="mb-2 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">{emptyLabel}</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Los archivos se suben a Vercel Blob al guardar el producto.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {showImages && hasImages ? (
            <MediaGrid label={mode === "all" ? "Imágenes" : undefined}>
              {existingImages.map((url) => (
                <MediaTile
                  key={url}
                  kind="image"
                  src={url}
                  alt="Imagen del producto"
                  onRemove={() => removeExistingImage(url)}
                  disabled={disabled}
                />
              ))}
              {localImages.map((item) => (
                <MediaTile
                  key={item.id}
                  kind="image"
                  src={item.previewUrl}
                  alt={item.file.name}
                  badge="Nuevo"
                  meta={formatBytes(item.file.size)}
                  onRemove={() => removeLocalItem(item.id)}
                  disabled={disabled}
                />
              ))}
            </MediaGrid>
          ) : null}

          {showVideos && hasVideos ? (
            <MediaGrid label={mode === "all" ? "Videos" : undefined}>
              {existingVideos.map((url) => (
                <MediaTile
                  key={url}
                  kind="video"
                  src={url}
                  alt="Video del producto"
                  onRemove={() => removeExistingVideo(url)}
                  disabled={disabled}
                />
              ))}
              {localVideos.map((item) => (
                <MediaTile
                  key={item.id}
                  kind="video"
                  src={item.previewUrl}
                  alt={item.file.name}
                  badge="Nuevo"
                  meta={formatBytes(item.file.size)}
                  onRemove={() => removeLocalItem(item.id)}
                  disabled={disabled}
                />
              ))}
            </MediaGrid>
          ) : null}
        </div>
      )}
    </div>
  )
}

function MediaGrid({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      {label ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  )
}

function MediaTile({
  kind,
  src,
  alt,
  badge,
  meta,
  onRemove,
  disabled,
}: {
  kind: "image" | "video"
  src: string
  alt: string
  badge?: string
  meta?: string
  onRemove: () => void
  disabled?: boolean
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted">
      <div className="relative aspect-square">
        {kind === "image" ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <>
            <video
              src={src}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <RiPlayCircleLine className="size-8 text-white drop-shadow" />
            </div>
          </>
        )}
      </div>

      {badge ? (
        <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
          {badge}
        </span>
      ) : null}

      {meta ? (
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {meta}
        </span>
      ) : null}

      <button
        type="button"
        aria-label={`Quitar ${alt}`}
        disabled={disabled}
        onClick={onRemove}
        className={cn(
          "absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white transition",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          disabled && "cursor-not-allowed opacity-40"
        )}
      >
        <RiCloseLine className="size-3.5" />
      </button>
    </div>
  )
}

export function buildProductMediaFormData(
  localItems: LocalMediaItem[],
  productId?: string
): FormData {
  const formData = new FormData()
  if (productId) formData.set("productId", productId)

  for (const item of localItems) {
    if (item.kind === "image") formData.append("images", item.file)
    else formData.append("videos", item.file)
  }

  return formData
}
