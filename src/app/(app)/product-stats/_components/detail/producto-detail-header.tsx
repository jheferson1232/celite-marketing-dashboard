"use client"

import Link from "next/link"
import { RiArrowLeftLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import type { ProductoPlatformFilter } from "../../_lib/use-producto-platform-filter"
import { ProductoDateRangePicker } from "../sales/producto-date-range-picker"
import { ProductoPlatformFilter as ProductoPlatformFilterPicker } from "./producto-platform-filter"

interface ProductoDetailHeaderProps {
  from: string
  to: string
  onRangeChange: (range: { from: string; to: string }) => void
  platformFilter: ProductoPlatformFilter
  onPlatformFilterChange: (platform: ProductoPlatformFilter) => void
  backHref?: string
}

export function ProductoDetailHeader({
  from,
  to,
  onRangeChange,
  platformFilter,
  onPlatformFilterChange,
  backHref = "/products",
}: ProductoDetailHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Button type="button" variant="ghost" size="sm" asChild className="w-fit">
        <Link href={backHref}>
          <RiArrowLeftLine className="size-4" />
          Volver al catálogo
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <ProductoPlatformFilterPicker
          value={platformFilter}
          onChange={onPlatformFilterChange}
        />
        <ProductoDateRangePicker
          from={from}
          to={to}
          onRangeChange={onRangeChange}
        />
      </div>
    </div>
  )
}
