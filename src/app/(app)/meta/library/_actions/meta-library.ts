"use server"

import { createServerAction } from "@/lib/server-action"
import {
  createMetaLibraryEntry,
  deleteMetaLibraryEntry,
  getMetaLibraryEntry,
  listMetaLibraryEntries,
  updateMetaLibraryEntry,
  type MetaLibraryEntryInput,
} from "@/lib/services/meta/library/meta-library-entries"
import {
  fetchMetaLibraryEntryAds,
  fetchMetaLibraryEntryDetail,
} from "@/lib/services/meta/library/meta-library-ads"
import { fetchStoreProductPreview } from "@/lib/services/landing-page-preview"
import { isSociaVaultApiKeyConfigured } from "@/lib/services/sociavault/sociavault-setup"

export const listMetaLibraryEntriesAction = createServerAction(async () =>
  listMetaLibraryEntries()
)

export const getMetaLibraryEntryAction = createServerAction(async (id: string) =>
  getMetaLibraryEntry(id)
)

export const createMetaLibraryEntryAction = createServerAction(
  async (input: MetaLibraryEntryInput) => createMetaLibraryEntry(input)
)

export const updateMetaLibraryEntryAction = createServerAction(
  async (input: { id: string; data: MetaLibraryEntryInput }) =>
    updateMetaLibraryEntry(input.id, input.data)
)

export const deleteMetaLibraryEntryAction = createServerAction(async (id: string) => {
  await deleteMetaLibraryEntry(id)
  return { ok: true }
})

export const getSociaVaultSetupStatusAction = createServerAction(async () => ({
  configured: isSociaVaultApiKeyConfigured(),
}))

export const getMetaLibraryEntryStorePreviewAction = createServerAction(
  async (entryId: string) => {
    const entry = await getMetaLibraryEntry(entryId)
    if (!entry?.url) return null
    return fetchStoreProductPreview(entry.url)
  }
)

/** Lee anuncios guardados en BD (sin gastar créditos SociaVault). */
export const fetchMetaLibraryEntryAdsAction = createServerAction(
  async (entryId: string) => {
    const entry = await getMetaLibraryEntry(entryId)
    if (!entry) {
      throw new Error("Entrada no encontrada")
    }
    return fetchMetaLibraryEntryAds(entry, { forceRefresh: false })
  }
)

/** Consulta SociaVault y persiste el resultado en BD. */
export const syncMetaLibraryEntrySociaVaultAction = createServerAction(
  async (entryId: string) => {
    const entry = await getMetaLibraryEntry(entryId)
    if (!entry) {
      throw new Error("Entrada no encontrada")
    }
    return fetchMetaLibraryEntryAds(entry, { forceRefresh: true })
  }
)

export const fetchMetaLibraryEntryDetailAction = createServerAction(
  async (entryId: string) => {
    const entry = await getMetaLibraryEntry(entryId)
    if (!entry) {
      throw new Error("Entrada no encontrada")
    }
    return fetchMetaLibraryEntryDetail(entry)
  }
)
