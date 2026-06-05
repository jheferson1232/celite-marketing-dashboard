import prisma from "@/lib/prisma"
import { mapStorePendingRow } from "./map-store-pending"
import type { StorePendingRecord } from "./types"

export async function listStorePending(): Promise<StorePendingRecord[]> {
  const rows = await prisma.storePending.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: { creatives: true },
      },
    },
  })

  const storeIds = rows.map((row) => row.id)
  const activeCounts =
    storeIds.length > 0
      ? await prisma.storePendingCreative.groupBy({
          by: ["storeId"],
          where: { storeId: { in: storeIds }, isActive: true },
          _count: { _all: true },
        })
      : []

  const activeByStore = new Map(
    activeCounts.map((row) => [row.storeId, row._count._all])
  )

  return rows.map((row) =>
    mapStorePendingRow(row, {
      activeCreativeCount: activeByStore.get(row.id) ?? 0,
    })
  )
}
