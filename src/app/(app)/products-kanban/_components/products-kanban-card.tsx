"use client"

import Link from "next/link"
import { useState } from "react"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { RiExternalLinkLine, RiRocketLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useProductCoverImage } from "@/app/(app)/products/_lib/use-product-cover-image"
import { ProductCoverVisual } from "@/app/(app)/products/_components/product/product-cover-visual"
import type { ProductRecord } from "@/lib/services/product"
import { ProductTikTokLaunchDialog } from "@/app/(app)/products/_components/launch/product-tiktok-launch-dialog"

interface ProductsKanbanCardProps {
  product: ProductRecord
  isDragging?: boolean
  onLaunched?: () => void
}

export function ProductsKanbanCard({
  product,
  isDragging = false,
  onLaunched,
}: ProductsKanbanCardProps) {
  const [launchOpen, setLaunchOpen] = useState(false)
  const { coverImage, coverVideo, isLoadingCover } = useProductCoverImage(product)
  const campaignCount = product.campaigns.length
  const canLaunch = product.status === "ready" || product.status === "draft"

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: product.id,
    data: { product, status: product.status },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card shadow-sm transition",
        isDragging && "opacity-60 ring-2 ring-primary/30"
      )}
    >
      <div
        {...listeners}
        {...attributes}
        className={cn(
          "cursor-grab active:cursor-grabbing",
          "rounded-t-lg border-b bg-muted/30 p-2"
        )}
        aria-label={`Arrastrar ${product.name}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
          <ProductCoverVisual
            coverImage={coverImage}
            coverVideo={coverVideo}
            isLoading={isLoadingCover}
            alt={product.name}
            sizes="240px"
          />
        </div>
      </div>

      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {product.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {campaignCount > 0
            ? `${campaignCount} campaña${campaignCount === 1 ? "" : "s"}`
            : "Sin campañas"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/products/${product.id}`}
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium text-primary",
              "hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            onClick={(event) => event.stopPropagation()}
          >
            Editar
            <RiExternalLinkLine className="size-3" />
          </Link>
          {canLaunch ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={(event) => {
                event.stopPropagation()
                setLaunchOpen(true)
              }}
            >
              <RiRocketLine className="size-3" />
              TikTok
            </Button>
          ) : null}
        </div>
      </div>

      <ProductTikTokLaunchDialog
        product={product}
        variant="kanban"
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        onLaunched={onLaunched}
      />
    </div>
  )
}
