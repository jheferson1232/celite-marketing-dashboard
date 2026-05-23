"use client"

import { useQuery } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { useProductoDateRange } from "./use-producto-date-range"
import { getProductSalesHistoryAction } from "../_actions/products"

export function useProductoSalesHistory(
  productId: string,
  campaignCount: number
) {
  const { dateRange } = useProductoDateRange()

  return useQuery({
    queryKey: ["product-sales-history", productId, dateRange],
    queryFn: () =>
      runServerAction(
        getProductSalesHistoryAction({ productId, dateRange })
      ),
    enabled: Boolean(productId) && campaignCount > 0,
  })
}
