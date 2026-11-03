"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getSavedBufferSnapshot,
  refreshBufferBoard,
  refreshBufferSnapshot,
  refreshBufferTikTokInvestments,
} from "@/lib/services/buffer/buffer-store"

export const getSavedBufferSnapshotAction = createServerAction(async () =>
  getSavedBufferSnapshot()
)

export const refreshBufferBoardAction = createServerAction(
  async (organizationId: string | null) => refreshBufferBoard(organizationId)
)

export const refreshBufferTikTokInvestmentsAction = createServerAction(async () =>
  refreshBufferTikTokInvestments()
)

export const refreshBufferSnapshotAction = createServerAction(
  async (organizationId: string | null) => refreshBufferSnapshot(organizationId)
)
