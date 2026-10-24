"use server"

import { createServerAction } from "@/lib/server-action"
import { getBufferBoard, type BufferBoard } from "@/lib/services/buffer/buffer"
import {
  getBufferPostInvestments,
  type BufferPostInvestmentInput,
} from "@/lib/services/buffer/post-investment"

export const getBufferBoardAction = createServerAction(
  async (organizationId: string | null): Promise<BufferBoard> =>
    getBufferBoard(organizationId)
)

export const getBufferTikTokInvestmentsAction = createServerAction(
  async (posts: BufferPostInvestmentInput[]) => getBufferPostInvestments(posts)
)
