import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"

export type ArchivedSummaryProduct = {
  productId: string
  name: string
  archivedAt: string
}

function assertSettings() {
  if (!prisma.summaryDashboardSettings) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado. Redeploy o reiniciá tras prisma generate."
    )
  }
}

function parseArchived(raw: string | null | undefined): ArchivedSummaryProduct[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null
        const row = item as Record<string, unknown>
        const productId =
          typeof row.productId === "string" ? row.productId.trim() : ""
        if (!productId) return null
        return {
          productId,
          name:
            typeof row.name === "string" && row.name.trim()
              ? row.name.trim()
              : productId,
          archivedAt:
            typeof row.archivedAt === "string" && row.archivedAt
              ? row.archivedAt
              : new Date().toISOString(),
        } satisfies ArchivedSummaryProduct
      })
      .filter((item): item is ArchivedSummaryProduct => item != null)
  } catch {
    return []
  }
}

async function readArchivedRaw(): Promise<string> {
  assertSettings()
  const row = await prisma.summaryDashboardSettings.findUnique({
    where: { id: "default" },
  })
  return row?.archivedProducts ?? "[]"
}

async function writeArchived(items: ArchivedSummaryProduct[]): Promise<void> {
  assertSettings()
  await prisma.summaryDashboardSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      archivedProducts: JSON.stringify(items),
    },
    update: {
      archivedProducts: JSON.stringify(items),
    },
  })
}

export async function listArchivedSummaryProducts(): Promise<
  ArchivedSummaryProduct[]
> {
  return parseArchived(await readArchivedRaw())
}

export async function archiveSummaryProduct(input: {
  productId: string
  name: string
}): Promise<ArchivedSummaryProduct[]> {
  const productId = input.productId.trim()
  if (!productId) {
    throw new ServerActionError("Falta el id del producto.")
  }
  const current = await listArchivedSummaryProducts()
  if (current.some((item) => item.productId === productId)) {
    return current
  }
  const next = [
    {
      productId,
      name: input.name.trim() || productId,
      archivedAt: new Date().toISOString(),
    },
    ...current,
  ]
  await writeArchived(next)
  return next
}

export async function unarchiveSummaryProduct(
  productId: string
): Promise<ArchivedSummaryProduct[]> {
  const id = productId.trim()
  if (!id) {
    throw new ServerActionError("Falta el id del producto.")
  }
  const next = (await listArchivedSummaryProducts()).filter(
    (item) => item.productId !== id
  )
  await writeArchived(next)
  return next
}

/** Fusiona archivados locales (p. ej. de localStorage) en la BD sin borrar los ya guardados. */
export async function mergeArchivedSummaryProducts(
  items: Array<{ productId: string; name: string; archivedAt?: string }>
): Promise<ArchivedSummaryProduct[]> {
  const current = await listArchivedSummaryProducts()
  const byId = new Map(current.map((item) => [item.productId, item]))

  for (const item of items) {
    const productId = item.productId?.trim()
    if (!productId || byId.has(productId)) continue
    byId.set(productId, {
      productId,
      name: item.name?.trim() || productId,
      archivedAt:
        typeof item.archivedAt === "string" && item.archivedAt
          ? item.archivedAt
          : new Date().toISOString(),
    })
  }

  const next = [...byId.values()].toSorted((a, b) =>
    b.archivedAt.localeCompare(a.archivedAt)
  )
  await writeArchived(next)
  return next
}
