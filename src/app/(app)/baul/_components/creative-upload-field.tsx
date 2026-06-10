"use client"

import { useId, useRef, useState } from "react"
import { RiAddLine, RiLoader4Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { CREATIVE_MEDIA_ACCEPT } from "@/lib/services/blob/media-utils"

interface CreativeUploadFieldProps {
  disabled?: boolean
  multiple?: boolean
  label?: string
  uploadingLabel?: string
  variant?: "default" | "outline"
  error?: string | null
  onUpload: (file: File) => Promise<void>
  onUploadMany?: (files: File[]) => Promise<void>
}

function getUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return "No se pudo subir el creative"
}

export function CreativeUploadField({
  disabled = false,
  multiple = false,
  label = "Subir creative",
  uploadingLabel = "Subiendo…",
  variant = "default",
  error: externalError = null,
  onUpload,
  onUploadMany,
}: CreativeUploadFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const error = externalError ?? localError
  const isDisabled = disabled || uploading

  const openFilePicker = () => {
    if (isDisabled) return
    inputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files
    if (!fileList?.length) return

    const files = [...fileList]
    event.target.value = ""
    if (isDisabled) return

    setUploading(true)
    setLocalError(null)

    try {
      if (multiple && files.length > 1 && onUploadMany) {
        await onUploadMany(files)
      } else {
        for (const file of files) {
          await onUpload(file)
        }
      }
    } catch (uploadError) {
      setLocalError(getUploadErrorMessage(uploadError))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={CREATIVE_MEDIA_ACCEPT}
        multiple={multiple}
        className="sr-only"
        disabled={isDisabled}
        onChange={(event) => void handleFileChange(event)}
      />

      <Button
        type="button"
        variant={variant}
        disabled={isDisabled}
        className="shrink-0"
        onClick={openFilePicker}
      >
        {uploading ? (
          <RiLoader4Line className="size-4 animate-spin" />
        ) : (
          <RiAddLine className="size-4" />
        )}
        {uploading ? uploadingLabel : label}
      </Button>

      <p className="max-w-xs text-right text-[11px] leading-snug text-muted-foreground">
        JPG, PNG, WebP, GIF, MP4, MOV, WebM, M4V · máx. 100 MB
      </p>

      {error ? (
        <p
          role="alert"
          className="max-w-sm text-right text-xs leading-snug text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
