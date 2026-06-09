"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiAddLine, RiMetaLine, RiPlayFill, RiRefreshLine } from "@remixicon/react"
import { runServerAction } from "@/lib/server-action"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { MetaLibraryEntryRecord } from "@/lib/services/meta/library/meta-library-entries"
import {
  createMetaLibraryEntryAction,
  deleteMetaLibraryEntryAction,
  getSociaVaultSetupStatusAction,
  syncMetaLibraryEntrySociaVaultAction,
  listMetaLibraryEntriesAction,
  updateMetaLibraryEntryAction,
} from "../_actions/meta-library"
import { MetaLibraryEntryCard } from "./meta-library-entry-card"
import { MetaLibraryEntryFormDialog } from "./meta-library-entry-form-dialog"

const QUERY_KEY = ["meta-library-entries"] as const
const ADS_STALE_TIME = 5 * 60 * 1000

export function MetaLibraryContent() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<MetaLibraryEntryRecord | null>(
    null
  )

  const sociavaultQuery = useQuery({
    queryKey: ["sociavault-setup-status"],
    queryFn: () => runServerAction(getSociaVaultSetupStatusAction()),
  })

  const entriesQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => runServerAction(listMetaLibraryEntriesAction()),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: ["meta-library-entry-ads"] })
  }

  const createMutation = useMutation({
    mutationFn: (input: { url: string; facebookPage: string }) =>
      runServerAction(createMetaLibraryEntryAction(input)),
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      setEditingEntry(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: string
      data: { url: string; facebookPage: string }
    }) => runServerAction(updateMetaLibraryEntryAction(input)),
    onSuccess: () => {
      invalidate()
      setDialogOpen(false)
      setEditingEntry(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runServerAction(deleteMetaLibraryEntryAction(id)),
    onSuccess: invalidate,
  })

  const syncAllMutation = useMutation({
    mutationFn: async (entries: MetaLibraryEntryRecord[]) => {
      await Promise.all(
        entries.map((entry) =>
          queryClient.fetchQuery({
            queryKey: ["meta-library-entry-ads", entry.id],
            queryFn: () => runServerAction(syncMetaLibraryEntrySociaVaultAction(entry.id)),
            staleTime: ADS_STALE_TIME,
          })
        )
      )
    },
  })

  const formBusy = createMutation.isPending || updateMutation.isPending
  const entries = entriesQuery.data ?? []
  const canSyncAll = entries.length > 0 && sociavaultQuery.data?.configured !== false
  const formError = createMutation.error ?? updateMutation.error

  function openCreate() {
    setEditingEntry(null)
    setDialogOpen(true)
  }

  function openEdit(entry: MetaLibraryEntryRecord) {
    setEditingEntry(entry)
    setDialogOpen(true)
  }

  async function handleSubmit(data: { url: string; facebookPage: string }) {
    if (editingEntry) {
      await updateMutation.mutateAsync({ id: editingEntry.id, data })
      return
    }
    await createMutation.mutateAsync(data)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-2 text-center">
        <p className="text-muted-foreground text-sm">
          <Link href="/dashboard" className="hover:text-foreground">
            Meta
          </Link>
          <span className="mx-2">/</span>
          <span>Meta Library</span>
        </p>
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <RiMetaLine className="size-8 text-blue-600" />
          Meta Library
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-sm sm:text-base">
          Agrega una tienda o página de Facebook y consulta sus anuncios en Meta
          Ad Library con la API de SociaVault (search-companies, company-ads y
          búsqueda por keyword).
        </p>
        {sociavaultQuery.data && !sociavaultQuery.data.configured ? (
          <p className="mx-auto max-w-xl text-sm text-amber-600 dark:text-amber-500">
            Configura <code className="text-xs">SOCIAVAULT_API_KEY</code> para
            cargar anuncios activos.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canSyncAll || syncAllMutation.isPending}
          onClick={() => syncAllMutation.mutate(entries)}
          title="Consultar SociaVault para todas las entradas"
        >
          {syncAllMutation.isPending ? (
            <RiRefreshLine className="size-4 animate-spin" />
          ) : (
            <RiPlayFill className="size-4" />
          )}
          Sincronizar todo
        </Button>
        <Button type="button" onClick={openCreate}>
          <RiAddLine className="size-4" />
          Agregar
        </Button>
      </div>

      {entriesQuery.isLoading ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : entries.length ? (
        <div className="flex flex-col gap-4">
          {entries.map((entry) => (
            <MetaLibraryEntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => openEdit(entry)}
              onDelete={() => {
                if (confirm("¿Eliminar esta entrada?")) {
                  deleteMutation.mutate(entry.id)
                }
              }}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center text-sm">
          Aún no hay entradas. Agrega una tienda o una página de Facebook.
        </p>
      )}

      {syncAllMutation.error ? (
        <p className="text-destructive text-center text-sm">
          {syncAllMutation.error instanceof Error
            ? syncAllMutation.error.message
            : "Error al sincronizar con SociaVault"}
        </p>
      ) : null}

      {formError ? (
        <p className="text-destructive text-center text-sm">
          {formError instanceof Error
            ? formError.message
            : "Error al guardar la entrada"}
        </p>
      ) : null}

      <MetaLibraryEntryFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingEntry(null)
        }}
        entry={editingEntry}
        busy={formBusy}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
