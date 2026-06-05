"use server"

import { createServerAction } from "@/lib/server-action"
import { addStorePending } from "@/lib/services/store-pending/add-store-pending"
import { deleteStorePending } from "@/lib/services/store-pending/delete-store-pending"
import { getStorePendingDetail } from "@/lib/services/store-pending/get-store-pending-detail"
import { listStorePending } from "@/lib/services/store-pending/list-store-pending"
import { scrapeStorePendingMeta } from "@/lib/services/store-pending/scrape-store-meta"
import { isSociaVaultApiKeyConfigured } from "@/lib/services/sociavault/sociavault-setup"

export const listStorePendingAction = createServerAction(async () =>
  listStorePending()
)

export const getStorePendingDetailAction = createServerAction(
  async (storeId: string) => getStorePendingDetail(storeId)
)

export const getSociaVaultStoresSetupStatusAction = createServerAction(
  async () => ({
    configured: isSociaVaultApiKeyConfigured(),
  })
)

export const addStorePendingAction = createServerAction(
  async (input: { source: string }) => addStorePending(input)
)

export const scrapeStorePendingMetaAction = createServerAction(
  async (storeId: string) => scrapeStorePendingMeta(storeId)
)

export const deleteStorePendingAction = createServerAction(
  async (storeId: string) => {
    await deleteStorePending(storeId)
    return { ok: true as const }
  }
)
