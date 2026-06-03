"use client"

import { useRef, useState } from "react"
import { RiAddLine, RiLoader4Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { CREATIVE_MEDIA_ACCEPT } from "@/lib/services/blob/media-utils"

interface CreativeUploadFieldProps {
  disabled?: boolean
  multiple?: boolean
  label?: string
  uploadingLabel?: string
  variant?: "default" | "outline"
  onUpload: (file: File) => Promise<void>
  onUploadMany?: (files: File[]) => Promise<void>
}

export function CreativeUploadField({
  disabled = false,
  multiple = false,
  label = "Subir creative",
  uploadingLabel = "Subiendo…",
  variant = "default",
  onUpload,
  onUploadMany,
}: CreativeUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePickFile = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files
    event.target.value = ""
    if (!fileList?.length || disabled || uploading) return

    const files = [...fileList]
    setUploading(true)
    setError(null)

    try {
      if (multiple && files.length > 1 && onUploadMany) {
        await onUploadMany(files)
      } else {
        for (const file of files) {
          await onUpload(file)
        }
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo subir el creative"
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant={variant}
        onClick={handlePickFile}
        disabled={disabled || uploading}
        className="shrink-0"
      >
        {uploading ? (
          <RiLoader4Line className="size-4 animate-spin" />
        ) : (
          <RiAddLine className="size-4" />
        )}
        {uploading ? uploadingLabel : label}
      </Button>

      {error ? <p className="max-w-xs text-xs text-destructive">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept={CREATIVE_MEDIA_ACCEPT}
        multiple={multiple}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(event) => void handleFileChange(event)}
      />
    </div>
  )
}
