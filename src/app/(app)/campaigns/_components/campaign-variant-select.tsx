"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { listProductsAction } from "@/app/(app)/products/_actions/products"
import { cn } from "@/lib/utils"

type VariantOption = {
  id: string
  name: string
  productName: string
}

interface CampaignVariantSelectProps {
  value: string
  disabled?: boolean
  onChange: (variantId: string, variantName: string) => void
}

export function CampaignVariantSelect({
  value,
  disabled = false,
  onChange,
}: CampaignVariantSelectProps) {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => runServerAction(listProductsAction()),
    staleTime: 30 * 1000,
  })

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

  return (
    <div className="space-y-2">
      <label htmlFor="campaign-variant" className="text-sm font-medium">
        Variante de producto
      </label>
      <select
        id="campaign-variant"
        className={cn(
          "border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm shadow-xs",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        value={value}
        disabled={disabled || isLoading}
        onChange={(event) => {
          const nextId = event.target.value
          const variant = variants.find((entry) => entry.id === nextId)
          onChange(nextId, variant?.name ?? "")
        }}
      >
        <option value="">Selecciona una variante</option>
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id}>
            {variant.productName} · {variant.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Filtra los videos del Baúl vinculados a esta variante y define el nombre de los
        conjuntos en TikTok.
      </p>
    </div>
  )
}
