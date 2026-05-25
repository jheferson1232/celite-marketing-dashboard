"use client"

import { useRef, useState } from "react"
import { RiAddLine, RiLoader4Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"

interface CreativeUploadFieldProps {
  disabled?: boolean
  onUpload: (file: File) => Promise<void>
}

export function CreativeUploadField({
  disabled = false,
  onUpload,
}: CreativeUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePickFile = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || disabled || uploading) return

    setUploading(true)
    setError(null)

    try {
      await onUpload(file)
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
        onClick={handlePickFile}
        disabled={disabled || uploading}
        className="shrink-0"
      >
        {uploading ? (
          <RiLoader4Line className="size-4 animate-spin" />
        ) : (
          <RiAddLine className="size-4" />
        )}
        {uploading ? "Subiendo…" : "Subir creative"}
      </Button>

      {error ? <p className="max-w-xs text-xs text-destructive">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(event) => void handleFileChange(event)}
      />
    </div>
  )
}
