import type { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"
import { getBufferBoard, type BufferBoard } from "./buffer"
import {
  getBufferPostInvestments,
  type BufferPostInvestment,
} from "./post-investment"

const SNAPSHOT_ID = "default"

export type StoredBufferSnapshot = {
  board: BufferBoard
  investments: BufferPostInvestment[]
  syncedAt: string
}

function asSnapshot(row: {
  board: Prisma.JsonValue
  investments: Prisma.JsonValue
  syncedAt: Date
}): StoredBufferSnapshot {
  return {
    board: row.board as BufferBoard,
    investments: (row.investments ?? []) as BufferPostInvestment[],
    syncedAt: row.syncedAt.toISOString(),
  }
}

export async function getSavedBufferSnapshot(): Promise<StoredBufferSnapshot | null> {
  const row = await prisma.bufferSnapshot.findUnique({
    where: { id: SNAPSHOT_ID },
  })
  if (!row) return null
  return asSnapshot(row)
}

export async function refreshBufferSnapshot(
  organizationId?: string | null
): Promise<StoredBufferSnapshot> {
  const board = await getBufferBoard(organizationId)
  const tiktokPosts = board.posts.flatMap((post) => {
    if (post.channelService.toLowerCase() !== "tiktok") return []
    return [
      {
        id: post.id,
        text: post.text,
        externalLink: post.externalLink,
        thumbnail:
          post.assets.find((asset) => asset.thumbnail)?.thumbnail ?? null,
      },
    ]
  })
  const investments = await getBufferPostInvestments(tiktokPosts)
  const syncedAt = new Date()

  const row = await prisma.bufferSnapshot.upsert({
    where: { id: SNAPSHOT_ID },
    create: {
      id: SNAPSHOT_ID,
      board: board as unknown as Prisma.InputJsonValue,
      investments: investments as unknown as Prisma.InputJsonValue,
      syncedAt,
    },
    update: {
      board: board as unknown as Prisma.InputJsonValue,
      investments: investments as unknown as Prisma.InputJsonValue,
      syncedAt,
    },
  })

  return asSnapshot(row)
}
