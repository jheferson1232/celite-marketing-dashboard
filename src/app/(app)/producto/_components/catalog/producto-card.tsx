"use client"

import Image from "next/image"
import Link from "next/link"
import { RiImageLine } from "@remixicon/react"
import { cn } from "@/lib/utils"
import type { ProductRecord } from "@/lib/services/product"

interface ProductoCardProps {
  product: ProductRecord
}

export function ProductoCard({ product }: ProductoCardProps) {
  const campaignCount = product.campaigns.length

  return (
    <Link
      href={`/producto/${product.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition",
        "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <RiImageLine className="size-10 opacity-40" />
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
