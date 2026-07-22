"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RiAddLine, RiShoppingBag3Line } from "@remixicon/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { runServerAction } from "@/lib/server-action"
import { listProductsAction } from "@/app/(app)/products/_actions/products"
import { linkProductCampaignAction } from "@/app/(app)/product-stats/_actions/product-campaigns"
import { listMetaCampaignProductLinksAction } from "../../_actions/meta-campaign-product-links"

const LINKS_QUERY_KEY = ["meta-campaign-product-links"] as const
const PRODUCTS_QUERY_KEY = ["products"] as const

interface MetaCampaignProductLinkControlProps {
  campaignId: string
  campaignName: string
}

export function MetaCampaignProductLinkControl({
  campaignId,
  campaignName,
}: MetaCampaignProductLinkControlProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [feedback, setFeedback] = React.useState<string | null>(null)

  const linksQuery = useQuery({
    queryKey: LINKS_QUERY_KEY,
    queryFn: () => runServerAction(listMetaCampaignProductLinksAction()),
    staleTime: 60_000,
  })

  const productsQuery = useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: () => runServerAction(listProductsAction()),
    enabled: open,
    staleTime: 60_000,
  })

  const linkedProducts = React.useMemo(() => {
    const links = linksQuery.data ?? []
    return links.filter((link) => link.campaignId === campaignId)
  }, [linksQuery.data, campaignId])

  const linkedProductIds = React.useMemo(
    () => new Set(linkedProducts.map((link) => link.productId)),
    [linkedProducts]
  )

  const availableProducts = React.useMemo(() => {
    const products = productsQuery.data ?? []
    return products.filter((product) => !linkedProductIds.has(product.id))
  }, [productsQuery.data, linkedProductIds])

  const linkMutation = useMutation({
    mutationFn: (productId: string) =>
      runServerAction(
        linkProductCampaignAction({
          productId,
          campaignId,
          campaignName,
          platform: "meta",
        })
      ),
    onSuccess: async () => {
      setFeedback(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LINKS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["product-sales-history"] }),
      ])
      setOpen(false)
    },
    onError: (error) => {
      setFeedback(
        error instanceof Error ? error.message : "No se pudo vincular"
      )
    },
  })

  const hasLinks = linkedProducts.length > 0

  return (
    <div
      className="flex shrink-0 items-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      {hasLinks ? (
        <div className="flex max-w-[9rem] flex-wrap items-center gap-1">
          {linkedProducts.slice(0, 2).map((link) => (
            <Badge
              key={link.productId}
              variant="secondary"
              className="max-w-full truncate px-1.5 py-0 text-[10px] font-normal"
              title={link.productName}
            >
              <Link
                href={`/product-stats/${link.productId}`}
                className="truncate hover:underline"
              >
                {link.productName}
              </Link>
            </Badge>
          ))}
          {linkedProducts.length > 2 ? (
            <Badge
              variant="outline"
              className="px-1.5 py-0 text-[10px] font-normal"
              title={linkedProducts
                .slice(2)
                .map((link) => link.productName)
                .join(", ")}
            >
              +{linkedProducts.length - 2}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={hasLinks ? "ghost" : "outline"}
            size="icon-sm"
            className="size-7 shrink-0"
            aria-label={
              hasLinks
                ? `Agregar ${campaignName} a otro producto`
                : `Agregar ${campaignName} a productos`
            }
            title={hasLinks ? "Agregar a otro producto" : "Agregar a productos"}
          >
            {hasLinks ? (
              <RiAddLine className="size-3.5" />
            ) : (
              <RiShoppingBag3Line className="size-3.5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2" side="bottom">
          <p className="text-muted-foreground mb-2 px-1 text-xs font-medium">
            {hasLinks ? "Agregar a otro producto" : "Agregar a productos"}
          </p>
          {productsQuery.isLoading ? (
            <p className="text-muted-foreground px-1 py-2 text-xs">
              Cargando productos…
            </p>
          ) : availableProducts.length === 0 ? (
            <p className="text-muted-foreground px-1 py-2 text-xs">
              {productsQuery.data?.length
                ? "Ya está en todos los productos."
                : "No hay productos. Creá uno en Productos."}
            </p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
              {availableProducts.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    className="hover:bg-muted flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm disabled:opacity-50"
                    disabled={linkMutation.isPending}
                    onClick={() => linkMutation.mutate(product.id)}
                  >
                    <span className="truncate">{product.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {feedback ? (
            <p className="text-destructive mt-2 px-1 text-xs" role="alert">
              {feedback}
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
