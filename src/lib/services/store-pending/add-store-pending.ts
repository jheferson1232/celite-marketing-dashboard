import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { mapStorePendingRow } from "./map-store-pending"
import { resolveStorePendingInput } from "./resolve-store-pending-input"
import type { StorePendingRecord } from "./types"

export type AddStorePendingInput = {
  source: string
}

export async function addStorePending(
  input: AddStorePendingInput
): Promise<StorePendingRecord> {
  const resolved = resolveStorePendingInput(input.source)

  const existing = await prisma.storePending.findFirst({
    where: {
      OR: [
        resolved.domain ? { domain: resolved.domain } : undefined,
        resolved.pageUrl ? { pageUrl: resolved.pageUrl } : undefined,
      ].filter(Boolean) as Array<{ domain: string } | { pageUrl: string }>,
    },
    select: { id: true },
  })

  if (existing) {
    throw new ServerActionError("Esta tienda o página ya está registrada.")
  }

  const row = await prisma.storePending.create({
    data: {
      name: resolved.name,
      domain: resolved.domain,
      pageUrl: resolved.pageUrl,
      country: "ALL",
      metaPageId: resolved.metaPageId,
      status: "IMPORTED",
    },
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

  return mapStorePendingRow(row)
}
