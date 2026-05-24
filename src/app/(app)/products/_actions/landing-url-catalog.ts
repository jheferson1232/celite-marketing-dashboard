"use server"

import { createServerAction } from "@/lib/server-action"
import {
  createLandingUrlCatalogEntry,
  deleteLandingUrlCatalogEntry,
  listLandingUrlCatalog,
  syncLandingUrlCatalogFromText,
  type BulkSyncLandingUrlCatalogResult,
  type LandingUrlCatalogEntry,
} from "@/lib/services/landing-url-catalog"

export const listLandingUrlCatalogAction = createServerAction(
  async (): Promise<LandingUrlCatalogEntry[]> => listLandingUrlCatalog()
)

export const createLandingUrlCatalogAction = createServerAction(
  async (input: { url: string; label?: string | null }) =>
    createLandingUrlCatalogEntry(input)
)

export const deleteLandingUrlCatalogAction = createServerAction(
  async (id: string): Promise<void> => deleteLandingUrlCatalogEntry(id)
)

export const syncLandingUrlCatalogAction = createServerAction(
  async (raw: string): Promise<BulkSyncLandingUrlCatalogResult> =>
    syncLandingUrlCatalogFromText(raw)
)
