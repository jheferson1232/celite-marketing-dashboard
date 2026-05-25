"use client"

import type { ProductRecord } from "@/lib/services/product"
import { ProductoDetailInfo } from "../product/producto-detail-info"
import { ProductoSalesChart } from "../sales/producto-sales-chart"
import { ProductoSalesDailyTable } from "../sales/producto-sales-daily-table"
import { ProductoSalesSummary } from "../sales/producto-sales-summary"

interface ProductoDetailOverviewProps {
  product: ProductRecord
  onEdit: () => void
  onDelete: () => void
  isDeleting?: boolean
}

export function ProductoDetailOverview({
  product,
  onEdit,
  onDelete,
  isDeleting,
}: ProductoDetailOverviewProps) {
  const campaignCount = product.campaigns.length

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-3 lg:items-start">
      <div className="min-w-0 space-y-4">
        <ProductoDetailInfo
          product={product}
          onEdit={onEdit}
          onDelete={onDelete}
          isDeleting={isDeleting}
        />
        <ProductoSalesSummary
          productId={product.id}
          campaignCount={campaignCount}
        />
      </div>
      <ProductoSalesChart
        productId={product.id}
        campaignCount={campaignCount}
      />
      <ProductoSalesDailyTable
        productId={product.id}
        campaignCount={campaignCount}
      />
    </div>
  )
}
