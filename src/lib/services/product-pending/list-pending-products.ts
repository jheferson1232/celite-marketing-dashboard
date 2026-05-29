import prisma from "@/lib/prisma"
import type { PendingProductRecord } from "./types"
import { mapPendingProductRow } from "./map-pending-product"

export async function listPendingProducts(): Promise<PendingProductRecord[]> {
  const rows = await prisma.dropiFavoriteProduct.findMany({
    orderBy: [{ updatedAt: "desc" }],
    include: {
      matches: {
        orderBy: [{ score: "desc" }],
      },
    },
  })

  return rows.map(mapPendingProductRow)
}

export async function getLatestPendingSyncRun() {
  return prisma.pendingSyncRun.findFirst({
    orderBy: { startedAt: "desc" },
  })
}
