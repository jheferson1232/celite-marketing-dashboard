import type { Prisma } from "@/app/generated/prisma/client"
import prisma from "@/lib/prisma"
import { getBufferBoard, type BufferBoard } from "./buffer"
import {
  getBufferPostInvestments,
  type BufferPostInvestment,
  type BufferPostVideoAd,
} from "./post-investment"

const SNAPSHOT_ID = "default"

export type StoredBufferSnapshot = {
  board: BufferBoard
  investments: BufferPostInvestment[]
  catalog: BufferPostVideoAd[]
  syncedAt: string
}

function readInvestments(value: Prisma.JsonValue): {
  posts: BufferPostInvestment[]
  catalog: BufferPostVideoAd[]
} {
  if (Array.isArray(value)) {
    return { posts: value as BufferPostInvestment[], catalog: [] }
  }
  if (value && typeof value === "object") {
    const record = value as { posts?: unknown; catalog?: unknown }
    return {
      posts: Array.isArray(record.posts) ? (record.posts as BufferPostInvestment[]) : [],
      catalog: Array.isArray(record.catalog) ? (record.catalog as BufferPostVideoAd[]) : [],
    }
  }
  return { posts: [], catalog: [] }
}

function asSnapshot(row: {
  board: Prisma.JsonValue
  investments: Prisma.JsonValue
  syncedAt: Date
}): StoredBufferSnapshot {
  const stored = readInvestments(row.investments)
  return {
    board: row.board as BufferBoard,
    investments: stored.posts,
    catalog: stored.catalog,
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
  const { posts, catalog } = await getBufferPostInvestments(tiktokPosts)
  const syncedAt = new Date()
  const investments = { posts, catalog } as unknown as Prisma.InputJsonValue

  const row = await prisma.bufferSnapshot.upsert({
    where: { id: SNAPSHOT_ID },
    create: {
      id: SNAPSHOT_ID,
      board: board as unknown as Prisma.InputJsonValue,
      investments,
      syncedAt,
    },
    update: {
      board: board as unknown as Prisma.InputJsonValue,
      investments,
      syncedAt,
    },
  })

  return asSnapshot(row)
}
