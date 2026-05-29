import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"

export async function togglePendingMatchFavorite(
  matchId: string
): Promise<{ id: string; isFavorite: boolean }> {
  const match = await prisma.productPendingMatch.findUnique({
    where: { id: matchId },
    select: { id: true, isFavorite: true },
  })

  if (!match) {
    throw new ServerActionError("Video no encontrado.")
  }

  const updated = await prisma.productPendingMatch.update({
    where: { id: matchId },
    data: { isFavorite: !match.isFavorite },
    select: { id: true, isFavorite: true },
  })

  return updated
}
