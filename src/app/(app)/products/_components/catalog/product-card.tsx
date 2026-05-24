"use client"

import Image from "next/image"
import Link from "next/link"
import { RiImageLine, RiPlayCircleLine } from "@remixicon/react"
import { cn } from "@/lib/utils"
import { useProductCoverImage } from "@/app/(app)/products/_lib/use-product-cover-image"
import { getProductMediaCounts } from "@/lib/products/cover-image"
import type { ProductRecord } from "@/lib/services/product"

interface ProductCardProps {
  product: ProductRecord
  basePath?: "/products" | "/producto"
}

export function ProductCard({
  product,
  basePath = "/products",
}: ProductCardProps) {
  const { coverImage, isLoadingCover } = useProductCoverImage(product)
  const { imageCount, videoCount } = getProductMediaCounts(product)
  const campaignCount = product.campaigns.length

  return (
    <Link
      href={`${basePath}/${product.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition",
        "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={product.name}
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
          />
        ) : isLoadingCover ? (
          <div className="h-full w-full animate-pulse bg-muted-foreground/10" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <RiImageLine className="size-10 opacity-40" />
          </div>
        )}

        {(imageCount > 1 || videoCount > 0) && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            {imageCount > 1 ? (
              <span className="rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                +{imageCount - 1} img
              </span>
            ) : null}
            {videoCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <RiPlayCircleLine className="size-3" />
                {videoCount}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">
          {product.name}
        </p>
        {campaignCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {campaignCount} campaña{campaignCount === 1 ? "" : "s"} vinculada
            {campaignCount === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sin campañas vinculadas</p>
        )}
      </div>
    </Link>
  )
}
