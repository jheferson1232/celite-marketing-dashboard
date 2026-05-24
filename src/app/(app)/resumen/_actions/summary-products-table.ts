"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getSummaryProductsTable,
  type SummaryProductsTable,
} from "@/lib/services/summary/products-summary-table"
import type { DateRange } from "@/lib/services/meta/types"

export const getSummaryProductsTableAction = createServerAction(
  async (dateRange: DateRange): Promise<SummaryProductsTable> =>
    getSummaryProductsTable(dateRange)
)
