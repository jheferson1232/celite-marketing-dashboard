"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiExternalLinkLine, RiLinkM, RiListSettingsLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import type { LandingPageRecord } from "@/lib/services/landing-page"
import type { ProductLandingPageRecord } from "@/lib/services/product"
import {
  createLandingPageAction,
  deleteLandingPageAction,
  listLandingPagesAction,
  updateLandingPageAction,
} from "../../_actions/landing-pages"
import { LandingPageAssociateDialog } from "./landing-page-associate-dialog"
import { LandingPageDeleteDialog } from "./landing-page-delete-dialog"
import { LandingPageFormDialog } from "./landing-page-form-dialog"

interface LandingPagesPanelProps {
  productLandingPages: ProductLandingPageRecord[]
  onAddToProduct: (landingPage: ProductLandingPageRecord) => void
  onRemoveFromProduct: (landingPageId: string) => void
  onLandingPageCreated: (landingPage: ProductLandingPageRecord) => void
  onLandingPageUpdated: (landingPage: ProductLandingPageRecord) => void
  onLandingPageDeleted: (landingPageId: string) => void
  disabled?: boolean
}

function toProductLandingPage(page: LandingPageRecord): ProductLandingPageRecord {
  return {
    id: page.id,
    url: page.url,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  }
}

export function LandingPagesPanel({
  productLandingPages,
  onAddToProduct,
  onRemoveFromProduct,
  onLandingPageCreated,
  onLandingPageUpdated,
  onLandingPageDeleted,
  disabled = false,
}: LandingPagesPanelProps) {
  const queryClient = useQueryClient()
  const [associateOpen, setAssociateOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<LandingPageRecord | null>(null)

  const assignedIds = new Set(productLandingPages.map((page) => page.id))

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["landing-pages"],
    queryFn: () => runServerAction(listLandingPagesAction()),
    staleTime: 60 * 1000,
  })

  const sortedAssigned = useMemo(
    () => [...productLandingPages].sort((a, b) => a.url.localeCompare(b.url)),
    [productLandingPages]
  )

  const createMutation = useMutation({
    mutationFn: (input: { url: string }) =>
      runServerAction(createLandingPageAction(input)),
    onSuccess: (created) => {
      if (!created) return
      void queryClient.invalidateQueries({ queryKey: ["landing-pages"] })
      onLandingPageCreated(toProductLandingPage(created))
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; url: string }) =>
      runServerAction(updateLandingPageAction(input)),
    onSuccess: (updated) => {
      if (!updated) return
      void queryClient.invalidateQueries({ queryKey: ["landing-pages"] })
      onLandingPageUpdated(toProductLandingPage(updated))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runServerAction(deleteLandingPageAction(id)),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ["landing-pages"] })
      onLandingPageDeleted(id)
      setDeleteOpen(false)
      setSelectedEntry(null)
    },
  })

  const crudBusy =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const panelDisabled = disabled || crudBusy

  const openCreate = () => {
    setSelectedEntry(null)
    setFormOpen(true)
  }

  const openEdit = (entry: LandingPageRecord) => {
    setSelectedEntry(entry)
    setFormOpen(true)
  }

  const openDelete = (entry: LandingPageRecord) => {
    setSelectedEntry(entry)
    setDeleteOpen(true)
  }

  const toggleAssociation = (landingPage: LandingPageRecord) => {
    if (assignedIds.has(landingPage.id)) {
      onRemoveFromProduct(landingPage.id)
    } else {
      onAddToProduct(toProductLandingPage(landingPage))
    }
  }

  const assignedCount = productLandingPages.length

  return (
    <>
      <aside className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm lg:sticky lg:top-6">
        <div className="flex items-start gap-3">
          <RiLinkM className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Landing pages</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Vista de landing pages asociadas. Usa Gestionar para administrar el
              catálogo.
            </p>
            {!isLoading ? (
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {assignedCount} asignada{assignedCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          disabled={panelDisabled}
          onClick={() => setAssociateOpen(true)}
        >
          <RiListSettingsLine className="size-3.5" />
          Gestionar
        </Button>

        {isLoading ? (
          <Skeleton className="min-h-[120px] w-full rounded-lg" />
        ) : sortedAssigned.length === 0 ? (
          <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            <p>Sin landing pages asociadas.</p>
          </div>
        ) : (
          <ul className="max-h-[min(420px,50vh)] space-y-1 overflow-y-auto">
            {sortedAssigned.map((landingPage) => (
              <li
                key={landingPage.id}
                className="flex items-start gap-1 rounded-md border bg-muted/30 px-2 py-1.5"
                title={landingPage.url}
              >
                <span className="min-w-0 flex-1 font-mono text-xs leading-snug break-all">
                  {landingPage.url}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  asChild
                >
                  <a
                    href={landingPage.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${landingPage.url} en nueva pestaña`}
                  >
                    <RiExternalLinkLine className="size-3.5" />
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <LandingPageAssociateDialog
        open={associateOpen}
        onOpenChange={setAssociateOpen}
        catalog={catalog}
        assignedIds={assignedIds}
        isLoading={isLoading}
        disabled={panelDisabled}
        onToggleAssociation={toggleAssociation}
        onEdit={openEdit}
        onDelete={openDelete}
        onCreateNew={openCreate}
      />

      <LandingPageFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={selectedEntry}
        isPending={createMutation.isPending || updateMutation.isPending}
        onSubmit={async (values) => {
          if (selectedEntry) {
            await updateMutation.mutateAsync({
              id: selectedEntry.id,
              url: values.url,
            })
          } else {
            await createMutation.mutateAsync({ url: values.url })
          }
        }}
      />

      <LandingPageDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        url={selectedEntry?.url ?? ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (selectedEntry) deleteMutation.mutate(selectedEntry.id)
        }}
      />
    </>
  )
}
