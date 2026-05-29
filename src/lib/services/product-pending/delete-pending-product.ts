import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"

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

  await prisma.dropiFavoriteProduct.delete({ where: { id: productId } })

  return { id: productId }
}
