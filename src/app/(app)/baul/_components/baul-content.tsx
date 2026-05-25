"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import type { CreativeRecord } from "@/lib/services/creative"
import { listProductsAction } from "@/app/(app)/products/_actions/products"
import {
  createCreativeAction,
  deleteCreativeAction,
  listCreativesAction,
  updateCreativeAction,
} from "../_actions/creatives"
import { CreativeCard } from "./creative-card"
import { CreativeDeleteDialog } from "./creative-delete-dialog"
import { CreativeEditDialog } from "./creative-edit-dialog"
import { CreativeUploadField } from "./creative-upload-field"

export function BaulContent() {
  const queryClient = useQueryClient()
  const [selectedCreative, setSelectedCreative] = useState<CreativeRecord | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const {
    data: creatives = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["creatives"],
    queryFn: () => runServerAction(listCreativesAction()),
    staleTime: 30 * 1000,
  })

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: () => runServerAction(listProductsAction()),
    staleTime: 30 * 1000,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["creatives"] })
    void queryClient.invalidateQueries({ queryKey: ["products"] })
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)

      const created = await runServerAction(createCreativeAction(formData))
      if (!created) throw new Error("No se pudo crear el creative")
      return created
    },
    onSuccess: (created) => {
      invalidate()
      setSelectedCreative(created)
      setEditOpen(true)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: string
      name: string | null
      variantIds: string[]
    }) =>
      runServerAction(
        updateCreativeAction({
          id: input.id,
          name: input.name,
          variantIds: input.variantIds,
        })
      ),
    onSuccess: (updated) => {
      invalidate()
      if (updated) setSelectedCreative(updated)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runServerAction(deleteCreativeAction(id)),
    onSuccess: () => {
      invalidate()
      setSelectedCreative(null)
      setEditOpen(false)
      setDeleteOpen(false)
    },
  })

  const openCreative = (creative: CreativeRecord) => {
    setSelectedCreative(creative)
    setEditOpen(true)
  }

  const creativeLabel =
    selectedCreative?.name?.trim() ||
    selectedCreative?.url.split("/").pop() ||
    "Creative"

  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Baúl</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Biblioteca centralizada de imágenes y videos reutilizables entre productos.
          </p>
        </div>

        <CreativeUploadField
          disabled={uploadMutation.isPending}
          onUpload={async (file) => {
            await uploadMutation.mutateAsync(file)
          }}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "No se pudieron cargar los creatives"}
        </p>
      ) : creatives.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay creatives. Sube el primero con el botón de arriba.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {creatives.map((creative) => (
            <CreativeCard
              key={creative.id}
              creative={creative}
              selected={selectedCreative?.id === creative.id}
              onSelect={() => openCreative(creative)}
            />
          ))}
        </div>
      )}

      <CreativeEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        creative={selectedCreative}
        products={products}
        disabled={updateMutation.isPending || deleteMutation.isPending || isLoadingProducts}
        onSave={async (values) => {
          const updated = await updateMutation.mutateAsync(values)
          if (!updated) throw new Error("No se pudo guardar el creative")
        }}
        onDelete={() => setDeleteOpen(true)}
      />

      <CreativeDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        creativeLabel={creativeLabel}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!selectedCreative) return
          deleteMutation.mutate(selectedCreative.id)
        }}
      />
    </div>
  )
}
