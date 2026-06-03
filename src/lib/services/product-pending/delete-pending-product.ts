import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import { deletePendingMatchBlobsForProduct } from "./delete-pending-match-blobs"

export async function deletePendingProduct(
  productId: string
): Promise<{ id: string }> {
  const product = await prisma.dropiFavoriteProduct.findUnique({
    where: { id: productId },
    select: { id: true },
  })

  if (!product) {
    throw new ServerActionError("Producto no encontrado.")
  }

  await deletePendingMatchBlobsForProduct(productId)
  await prisma.dropiFavoriteProduct.delete({ where: { id: productId } })

  return { id: productId }
}
