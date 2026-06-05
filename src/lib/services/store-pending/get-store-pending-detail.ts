import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { mapStorePendingDetailRow } from "./map-store-pending"
import type { StorePendingDetailRecord } from "./types"

export async function getStorePendingDetail(
  storeId: string
): Promise<StorePendingDetailRecord> {
  const row = await prisma.storePending.findUnique({
    where: { id: storeId },
    include: {
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 12,
      },
      creatives: {
        orderBy: [{ isActive: "desc" }, { score: "desc" }],
        take: 60,
      },
      _count: {
        select: { creatives: true },
      },
    },
  })

  if (!row) {
    throw new ServerActionError("Tienda no encontrada.")
  }

  return mapStorePendingDetailRow(row)
}
