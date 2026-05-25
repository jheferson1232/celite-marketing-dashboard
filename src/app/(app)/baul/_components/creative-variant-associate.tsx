"use client"

import { useMemo, useState } from "react"
import { RiLinkM, RiLinkUnlinkM, RiSearchLine } from "@remixicon/react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { ProductRecord } from "@/lib/services/product"

export type VariantOption = {
  id: string
  name: string
  productName: string
}

interface CreativeVariantAssociateProps {
  products: ProductRecord[]
  assignedIds: Set<string>
  disabled?: boolean
  onToggleAssociation: (variantId: string) => void
}

export function CreativeVariantAssociate({
  products,
  assignedIds,
  disabled = false,
  onToggleAssociation,
}: CreativeVariantAssociateProps) {
  const [search, setSearch] = useState("")

  const variants = useMemo<VariantOption[]>(() => {
    const rows: VariantOption[] = []
    for (const product of products) {
      for (const variant of product.variants) {
        rows.push({
          id: variant.id,
          name: variant.name,
          productName: product.name,
        })
      }
    }
    return rows.sort((a, b) =>
      `${a.productName} ${a.name}`.localeCompare(`${b.productName} ${b.name}`, "es")
    )
  }, [products])

  const filteredVariants = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return variants
    return variants.filter(
      (variant) =>
        variant.name.toLowerCase().includes(query) ||
        variant.productName.toLowerCase().includes(query)
    )
  }, [variants, search])

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Variantes asociadas</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Vincula este creative a variantes de producto.
        </p>
      </div>

      <div className="relative">
        <RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar variante o producto…"
          className="pl-8"
          disabled={disabled}
        />
      </div>

      <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border p-1">
        {filteredVariants.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            {variants.length === 0
              ? "No hay variantes en el catálogo."
              : "Ninguna variante coincide con la búsqueda."}
          </li>
        ) : (
          filteredVariants.map((variant) => {
            const isAssigned = assignedIds.has(variant.id)
            return (
              <li key={variant.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggleAssociation(variant.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition",
                    "hover:bg-muted/70",
                    isAssigned && "bg-primary/5"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{variant.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {variant.productName}
                    </span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {isAssigned ? (
                      <>
                        <RiLinkUnlinkM className="size-3.5" />
                        Desvincular
                      </>
                    ) : (
                      <>
                        <RiLinkM className="size-3.5" />
                        Vincular
                      </>
                    )}
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>

      <p className="text-xs text-muted-foreground">
        {assignedIds.size} variante{assignedIds.size === 1 ? "" : "s"} vinculada
        {assignedIds.size === 1 ? "" : "s"}.
      </p>
    </div>
  )
}
