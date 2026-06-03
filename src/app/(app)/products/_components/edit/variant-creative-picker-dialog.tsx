"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiArchiveLine, RiCheckLine, RiLoader4Line } from "@remixicon/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { runServerAction } from "@/lib/server-action"
import type { CreativeRecord } from "@/lib/services/creative"
import { uploadCreativeFileClient } from "@/lib/services/blob/creative-client-upload"
import { CreativeCard } from "@/app/(app)/baul/_components/creative-card"
import { CreativeUploadField } from "@/app/(app)/baul/_components/creative-upload-field"
import { createCreativeAction } from "@/app/(app)/baul/_actions/creatives"
import { listCreativesAction } from "../../_actions/creatives"

interface VariantCreativePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignedCreativeIds: Set<string>
  onConfirm: (creativeIds: string[]) => Promise<string | null>
  isPending?: boolean
}

async function uploadCreativeFile(file: File): Promise<CreativeRecord> {
  const uploaded = await uploadCreativeFileClient(file)
  const created = await runServerAction(
    createCreativeAction({
      url: uploaded.url,
      type: uploaded.type,
    })
  )
  if (!created) {
    throw new Error("No se pudo registrar el creative en el baúl.")
  }
  return created
}

export function VariantCreativePickerDialog({
  open,
  onOpenChange,
  assignedCreativeIds,
  onConfirm,
  isPending = false,
}: VariantCreativePickerDialogProps) {
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const {
    data: creatives = [],
    isLoading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: ["creatives"],
    queryFn: () => runServerAction(listCreativesAction()),
    staleTime: 30 * 1000,
    enabled: open,
  })

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const created: CreativeRecord[] = []
      for (const file of files) {
        created.push(await uploadCreativeFile(file))
      }
      return created
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["creatives"] })
      setSelectedIds((current) => {
        const next = new Set(current)
        for (const creative of created) {
          if (!assignedCreativeIds.has(creative.id)) {
            next.add(creative.id)
          }
        }
        return next
      })
      setError(null)
    },
    onError: (uploadError) => {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo subir el archivo."
      )
    },
  })

  const availableCreatives = useMemo(
    () => creatives.filter((creative) => !assignedCreativeIds.has(creative.id)),
    [creatives, assignedCreativeIds]
  )

  const busy = isPending || uploadMutation.isPending

  useEffect(() => {
    if (!open) return
    setSelectedIds(new Set())
    setError(null)
  }, [open])

  const toggleCreative = (creative: CreativeRecord) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(creative.id)) next.delete(creative.id)
      else next.add(creative.id)
      return next
    })
  }

  const handleConfirm = async () => {
    if (selectedIds.size === 0 || busy) return

    setError(null)
    const attachError = await onConfirm([...selectedIds])
    if (attachError) {
      setError(attachError)
      return
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,800px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Añadir creativos</DialogTitle>
          <DialogDescription>
            Sube archivos nuevos o elige imágenes y videos que ya estén en el baúl.
            Los seleccionados se vincularán a esta variante al confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="grid min-w-0 grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square w-full min-w-0 rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {queryError instanceof Error
                ? queryError.message
                : "No se pudo cargar el catálogo de creativos."}
            </p>
          ) : availableCreatives.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
              <RiArchiveLine className="mb-3 size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium">No hay creativos disponibles</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {creatives.length === 0
                  ? "Sube el primero con el botón de abajo."
                  : "Todos los creativos del baúl ya están vinculados a esta variante. Sube uno nuevo."}
              </p>
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-4 gap-2">
              {availableCreatives.map((creative) => (
                <div key={creative.id} className="relative min-w-0 max-w-[400px]">
                  <CreativeCard
                    creative={creative}
                    selected={selectedIds.has(creative.id)}
                    onSelect={() => toggleCreative(creative)}
                  />
                  {selectedIds.has(creative.id) ? (
                    <span
                      className={cn(
                        "pointer-events-none absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                      )}
                    >
                      <RiCheckLine className="size-3" />
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <p className="shrink-0 px-6 pb-2 text-sm text-destructive">{error}</p>
        ) : null}

        <DialogFooter className="shrink-0 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <CreativeUploadField
            disabled={busy}
            multiple
            variant="outline"
            label="Subir archivos"
            uploadingLabel="Subiendo…"
            onUpload={async (file) => {
              await uploadMutation.mutateAsync([file])
            }}
            onUploadMany={async (files) => {
              await uploadMutation.mutateAsync(files)
            }}
          />

          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={busy || selectedIds.size === 0}
            >
              {isPending ? (
                <>
                  <RiLoader4Line className="size-4 animate-spin" />
                  Vinculando…
                </>
              ) : selectedIds.size > 0 ? (
                `Añadir ${selectedIds.size} creativo${selectedIds.size === 1 ? "" : "s"}`
              ) : (
                "Añadir creativos"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
