"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getSavedBufferSnapshot,
  refreshBufferSnapshot,
} from "@/lib/services/buffer/buffer-store"

export const getSavedBufferSnapshotAction = createServerAction(async () =>
  getSavedBufferSnapshot()
)

export const refreshBufferSnapshotAction = createServerAction(
  async (organizationId: string | null) => refreshBufferSnapshot(organizationId)
)
