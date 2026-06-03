import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { deletePendingMatchBlobs } from "./delete-pending-match-blobs"

export async function deletePendingMatch(matchId: string): Promise<{ id: string }> {
  const match = await prisma.productPendingMatch.findUnique({
    where: { id: matchId },
    select: { id: true, favoriteId: true },
  })

  if (!match) {
    throw new ServerActionError("Video no encontrado.")
  }

  await deletePendingMatchBlobs(matchId)
  await prisma.productPendingMatch.delete({ where: { id: matchId } })

  const remaining = await prisma.productPendingMatch.count({
    where: { favoriteId: match.favoriteId },
  })

  if (remaining === 0) {
    await prisma.dropiFavoriteProduct.update({
      where: { id: match.favoriteId },
      data: { status: "NO_MATCH", lastError: null },
    })
  }

  return { id: matchId }
}
