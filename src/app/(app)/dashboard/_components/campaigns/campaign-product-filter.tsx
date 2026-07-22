"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { RiShoppingBag3Line } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { runServerAction } from "@/lib/server-action"
import { listProductsAction } from "@/app/(app)/products/_actions/products"
import type { ProductPlatform } from "@/lib/services/product"
import { cn } from "@/lib/utils"

interface CampaignProductFilterProps {
  platform: ProductPlatform
  selectedProductIds: Set<string>
  onSelectedProductIdsChange: (next: Set<string>) => void
}

export function CampaignProductFilter({
  platform,
  selectedProductIds,
  onSelectedProductIdsChange,
}: CampaignProductFilterProps) {
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => runServerAction(listProductsAction()),
    staleTime: 60_000,
  })

  const productsWithCampaigns = React.useMemo(() => {
    const products = productsQuery.data ?? []
    return products
      .map((product) => {
        const campaignCount = product.campaigns.filter(
          (link) => link.platform === platform
        ).length
        return { product, campaignCount }
      })
      .filter(({ campaignCount }) => campaignCount > 0)
      .toSorted((a, b) =>
        a.product.name.localeCompare(b.product.name, "es", {
          sensitivity: "base",
        })
      )
  }, [productsQuery.data, platform])

  const selectedCount = selectedProductIds.size
  const hasSelection = selectedCount > 0

  const toggleProduct = (productId: string, checked: boolean) => {
    const next = new Set(selectedProductIds)
    if (checked) next.add(productId)
    else next.delete(productId)
    onSelectedProductIdsChange(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "shrink-0 gap-2",
            hasSelection && "border-primary/50"
          )}
        >
          <RiShoppingBag3Line className="size-4" />
          Productos
          {hasSelection ? (
            <span className="bg-primary text-primary-foreground rounded-md px-1.5 text-[10px] font-semibold">
              {selectedCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Filtrar por producto</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {productsQuery.isLoading ? (
          <p className="text-muted-foreground px-2 py-1.5 text-xs">
            Cargando…
          </p>
        ) : productsWithCampaigns.length === 0 ? (
          <p className="text-muted-foreground px-2 py-1.5 text-xs">
            Ningún producto con campañas {platform === "meta" ? "Meta" : "TikTok"}{" "}
            vinculadas.
          </p>
        ) : (
          productsWithCampaigns.map(({ product, campaignCount }) => (
            <DropdownMenuCheckboxItem
              key={product.id}
              checked={selectedProductIds.has(product.id)}
              onCheckedChange={(checked) =>
                toggleProduct(product.id, Boolean(checked))
              }
              onSelect={(event) => event.preventDefault()}
            >
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate">{product.name}</span>
                <span className="text-muted-foreground shrink-0 text-[10px]">
                  {campaignCount}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
        {hasSelection ? (
          <>
            <DropdownMenuSeparator />
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground w-full px-2 py-1.5 text-left text-xs"
              onClick={() => onSelectedProductIdsChange(new Set())}
            >
              Quitar filtro
            </button>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** IDs de campaña vinculados a los productos seleccionados (plataforma dada). */
export function useCampaignIdsForSelectedProducts(
  platform: ProductPlatform,
  selectedProductIds: Set<string>
): Set<string> | null {
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => runServerAction(listProductsAction()),
    staleTime: 60_000,
    enabled: selectedProductIds.size > 0,
  })

  return React.useMemo(() => {
    if (selectedProductIds.size === 0) return null
    const products = productsQuery.data ?? []
    const campaignIds = new Set<string>()
    for (const product of products) {
      if (!selectedProductIds.has(product.id)) continue
      for (const link of product.campaigns) {
        if (link.platform === platform) campaignIds.add(link.campaignId)
      }
    }
    return campaignIds
  }, [platform, productsQuery.data, selectedProductIds])
}
