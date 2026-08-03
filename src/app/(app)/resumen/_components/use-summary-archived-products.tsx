"use client"

import { useCallback, useSyncExternalStore } from "react"
import type { ReactNode } from "react"
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

const STORAGE_KEY = "summary-archived-products:v1"

export type SummaryArchivedProduct = {
  productId: string
  name: string
  archivedAt: string
}

type Listener = () => void

const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function readArchived(): SummaryArchivedProduct[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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
        } satisfies SummaryArchivedProduct
      })
      .filter((item): item is SummaryArchivedProduct => item != null)
  } catch {
    return []
  }
}

function writeArchived(items: SummaryArchivedProduct[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // quota / private mode
  }
  emit()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

function getSnapshot() {
  return JSON.stringify(readArchived())
}

function getServerSnapshot() {
  return "[]"
}

export function useSummaryArchivedProducts() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )
  const archived: SummaryArchivedProduct[] = JSON.parse(snapshot)
  const archivedIds = new Set(archived.map((item) => item.productId))

  const archiveProduct = useCallback((product: { id: string; name: string }) => {
    const current = readArchived()
    if (current.some((item) => item.productId === product.id)) return
    writeArchived([
      {
        productId: product.id,
        name: product.name,
        archivedAt: new Date().toISOString(),
      },
      ...current,
    ])
  }, [])

  const unarchiveProduct = useCallback((productId: string) => {
    writeArchived(readArchived().filter((item) => item.productId !== productId))
  }, [])

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
        {archived.length === 0 ? (
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
                  onClick={(e) => {
                    e.preventDefault()
                    unarchiveProduct(item.productId)
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
    archiveProduct,
    unarchiveProduct,
    archivedMenu,
  }
}
