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
  tiktokSyncedAt: string | null
}

function readInvestments(value: Prisma.JsonValue): {
  posts: BufferPostInvestment[]
  catalog: BufferPostVideoAd[]
  tiktokSyncedAt: string | null
} {
  if (Array.isArray(value)) {
    return { posts: value as BufferPostInvestment[], catalog: [], tiktokSyncedAt: null }
  }
  if (value && typeof value === "object") {
    const record = value as {
      posts?: unknown
      catalog?: unknown
      tiktokSyncedAt?: unknown
    }
    return {
      posts: Array.isArray(record.posts) ? (record.posts as BufferPostInvestment[]) : [],
      catalog: Array.isArray(record.catalog) ? (record.catalog as BufferPostVideoAd[]) : [],
      tiktokSyncedAt:
        typeof record.tiktokSyncedAt === "string" ? record.tiktokSyncedAt : null,
    }
  }
  return { posts: [], catalog: [], tiktokSyncedAt: null }
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
    tiktokSyncedAt: stored.tiktokSyncedAt,
  }
}

function tiktokPostsFromBoard(board: BufferBoard) {
  return board.posts.flatMap((post) => {
    if (post.channelService.toLowerCase() !== "tiktok") return []
    return [
      {
        id: post.id,
        text: post.text,
        externalLink: post.externalLink,
        thumbnail: post.assets.find((asset) => asset.thumbnail)?.thumbnail ?? null,
      },
    ]
  })
}

const EMPTY_INVESTMENTS = {
  posts: [],
  catalog: [],
} as unknown as Prisma.InputJsonValue

export async function getSavedBufferSnapshot(): Promise<StoredBufferSnapshot | null> {
  const row = await prisma.bufferSnapshot.findUnique({
    where: { id: SNAPSHOT_ID },
  })
  if (!row) return null
  return asSnapshot(row)
}

export async function refreshBufferBoard(
  organizationId?: string | null
): Promise<StoredBufferSnapshot> {
  const board = await getBufferBoard(organizationId)
  const syncedAt = new Date()

  const row = await prisma.bufferSnapshot.upsert({
    where: { id: SNAPSHOT_ID },
    create: {
      id: SNAPSHOT_ID,
      board: board as unknown as Prisma.InputJsonValue,
      investments: EMPTY_INVESTMENTS,
      syncedAt,
    },
    update: {
      board: board as unknown as Prisma.InputJsonValue,
      syncedAt,
    },
  })

  return asSnapshot(row)
}

export async function refreshBufferTikTokInvestments(): Promise<StoredBufferSnapshot> {
  const existing = await prisma.bufferSnapshot.findUnique({
    where: { id: SNAPSHOT_ID },
  })
  if (!existing) {
    throw new Error(
      "No hay datos de Buffer guardados. Pulsa Actualizar para consultar Buffer primero."
    )
  }

  const board = existing.board as BufferBoard
  const { posts, catalog } = await getBufferPostInvestments(tiktokPostsFromBoard(board))
  const tiktokSyncedAt = new Date().toISOString()
  const investments = {
    posts,
    catalog,
    tiktokSyncedAt,
  } as unknown as Prisma.InputJsonValue

  const row = await prisma.bufferSnapshot.update({
    where: { id: SNAPSHOT_ID },
    data: { investments },
  })

  return asSnapshot(row)
}

/** Buffer + métricas TikTok en una sola pasada. */
export async function refreshBufferSnapshot(
  organizationId?: string | null
): Promise<StoredBufferSnapshot> {
  const board = await getBufferBoard(organizationId)
  const { posts, catalog } = await getBufferPostInvestments(tiktokPostsFromBoard(board))
  const syncedAt = new Date()
  const tiktokSyncedAt = syncedAt.toISOString()
  const investments = {
    posts,
    catalog,
    tiktokSyncedAt,
  } as unknown as Prisma.InputJsonValue

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
