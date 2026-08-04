"use client"

import { useEffect, useMemo, useRef } from "react"
import type { ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiArchiveLine, RiInboxUnarchiveLine } from "@remixicon/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { runServerAction } from "@/lib/server-action"
import {
  archiveSummaryProductAction,
  listArchivedSummaryProductsAction,
  mergeArchivedSummaryProductsAction,
  unarchiveSummaryProductAction,
} from "../_actions/archived-products"

const LEGACY_STORAGE_KEY = "summary-archived-products:v1"
const LEGACY_MIGRATED_KEY = "summary-archived-products:migrated-v1"

type LegacyArchivedProduct = {
  productId: string
  name: string
  archivedAt: string
}

function readLegacyLocalArchived(): LegacyArchivedProduct[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
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
        } satisfies LegacyArchivedProduct
      })
      .filter((item): item is LegacyArchivedProduct => item != null)
  } catch {
    return []
  }
}

function markLegacyMigrated() {
  try {
    localStorage.setItem(LEGACY_MIGRATED_KEY, "1")
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // ignore
  }
}

function wasLegacyMigrated(): boolean {
  try {
    return localStorage.getItem(LEGACY_MIGRATED_KEY) === "1"
  } catch {
    return false
  }
}

export function useSummaryArchivedProducts() {
  const queryClient = useQueryClient()
  const migratingRef = useRef(false)

  const archivedQuery = useQuery({
    queryKey: ["summary-archived-products"],
    queryFn: () => runServerAction(listArchivedSummaryProductsAction()),
  })

  const archived = archivedQuery.data ?? []
  const archivedIds = useMemo(
    () => new Set(archived.map((item) => item.productId)),
    [archived]
  )

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["summary-archived-products"] })

  const archiveMutation = useMutation({
    mutationFn: (product: { id: string; name: string }) =>
      runServerAction(
        archiveSummaryProductAction({
          productId: product.id,
          name: product.name,
        })
      ),
    onSuccess: async () => {
      await invalidate()
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: (productId: string) =>
      runServerAction(unarchiveSummaryProductAction(productId)),
    onSuccess: async () => {
      await invalidate()
    },
  })

  const mergeMutation = useMutation({
    mutationFn: (items: LegacyArchivedProduct[]) =>
      runServerAction(mergeArchivedSummaryProductsAction(items)),
    onSuccess: async () => {
      markLegacyMigrated()
      await invalidate()
    },
  })

  useEffect(() => {
    if (!archivedQuery.isSuccess || migratingRef.current) return
    if (wasLegacyMigrated()) return
    const legacy = readLegacyLocalArchived()
    if (legacy.length === 0) {
      markLegacyMigrated()
      return
    }
    migratingRef.current = true
    mergeMutation.mutate(legacy)
    // Solo al cargar la lista desde el servidor la primera vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mergeMutation.mutate es estable
  }, [archivedQuery.isSuccess])

  const archivedMenu: ReactNode = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-2">
          <RiArchiveLine className="size-4" />
          Archivados
          {archived.length > 0 ? (
            <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
              {archived.length}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="px-3 py-2">
          Archivados en este resumen
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {archivedQuery.isLoading ? (
          <div className="px-3 py-3">
            <Skeleton className="h-8 w-full" />
          </div>
        ) : archived.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">
            No hay productos archivados.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto py-1">
            {archived.map((item) => (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {item.name}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={unarchiveMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    unarchiveMutation.mutate(item.productId)
                  }}
                >
                  <RiInboxUnarchiveLine className="size-3.5" />
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return {
    archived,
    archivedIds,
    archiveProduct: (product: { id: string; name: string }) => {
      if (archiveMutation.isPending) return
      archiveMutation.mutate(product)
    },
    unarchiveProduct: (productId: string) => {
      if (unarchiveMutation.isPending) return
      unarchiveMutation.mutate(productId)
    },
    archivedMenu,
  }
}
