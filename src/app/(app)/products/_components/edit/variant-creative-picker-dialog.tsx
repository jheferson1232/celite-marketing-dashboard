"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
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
import { CreativeCard } from "@/app/(app)/baul/_components/creative-card"
import { listCreativesAction } from "../../_actions/creatives"

interface VariantCreativePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignedCreativeIds: Set<string>
  onConfirm: (creativeIds: string[]) => Promise<string | null>
  isPending?: boolean
}

export function VariantCreativePickerDialog({
  open,
  onOpenChange,
  assignedCreativeIds,
  onConfirm,
  isPending = false,
}: VariantCreativePickerDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const { data: creatives = [], isLoading, isError, error: queryError } = useQuery({
    queryKey: ["creatives"],
    queryFn: () => runServerAction(listCreativesAction()),
    staleTime: 30 * 1000,
    enabled: open,
  })

  const availableCreatives = useMemo(
    () => creatives.filter((creative) => !assignedCreativeIds.has(creative.id)),
    [creatives, assignedCreativeIds]
  )

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
    if (selectedIds.size === 0 || isPending) return

    setError(null)
    const attachError = await onConfirm([...selectedIds])
    if (attachError) {
      setError(attachError)
      return
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,800px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Añadir creativos</DialogTitle>
          <DialogDescription>
            Elige imágenes o videos ya subidos en el Baúl. Los nuevos archivos se
            suben desde{" "}
            <Link href="/baul" className="font-medium text-foreground underline-offset-4 hover:underline">
              Baúl
            </Link>
            .
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
                  ? "Sube el primero en el Baúl para poder asociarlo a esta variante."
                  : "Todos los creativos del Baúl ya están vinculados a esta variante."}
              </p>
              <Button type="button" variant="outline" className="mt-4" asChild>
                <Link href="/baul">Ir al Baúl</Link>
              </Button>
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

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isPending || selectedIds.size === 0 || availableCreatives.length === 0}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
