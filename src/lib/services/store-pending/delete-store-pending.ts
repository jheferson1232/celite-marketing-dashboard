import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"

export async function deleteStorePending(storeId: string): Promise<void> {
  const existing = await prisma.storePending.findUnique({
    where: { id: storeId },
    select: { id: true },
  })

  if (!existing) {
    throw new ServerActionError("Tienda no encontrada.")
  }

  await prisma.storePending.delete({
    where: { id: storeId },
  })
}
