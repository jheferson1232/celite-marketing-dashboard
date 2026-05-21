"use client"

import * as React from "react"
import {
  META_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { AdInsightRow } from "@/lib/services/meta/types"
import { TopCreativesPanel } from "./top-creatives-panel"
import { MetaCreativesTable } from "./meta-creatives-table"
import { TIKTOK_DASHBOARD_CURRENCY } from "@/lib/format"
import { hasVisibleCreativesForAdsView } from "./utils"
import { AdsGridSkeleton } from "./ads-grid-skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RiLayoutGridLine, RiListCheck2 } from "@remixicon/react"

interface AdsViewProps {
  data?: AdInsightRow[]
  isLoading: boolean
  currency?: CurrencyCode
}

function AdsEmptyState({ currency }: { currency: CurrencyCode }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed">
      <p className="text-sm text-muted-foreground">
        {currency === TIKTOK_DASHBOARD_CURRENCY
          ? "No hay creativos con gasto de S/ 2 o más en el periodo seleccionado."
          : "No se encontraron anuncios con gasto en el periodo seleccionado."}
      </p>
    </div>
  )
}

export function AdsView({
  data,
  isLoading,
  currency = META_DASHBOARD_CURRENCY,
}: AdsViewProps) {
  if (isLoading) {
    return <AdsGridSkeleton />
  }

  if (!data?.length || !hasVisibleCreativesForAdsView(data, currency)) {
    return <AdsEmptyState currency={currency} />
  }

  return (
    <Tabs defaultValue="grid" className="min-w-0 w-full space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Creativos</h2>
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="grid" className="flex-1 gap-2 sm:flex-none">
            <RiLayoutGridLine className="size-4" />
            Cards
          </TabsTrigger>
          <TabsTrigger value="table" className="flex-1 gap-2 sm:flex-none">
            <RiListCheck2 className="size-4" />
            Tabla
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="grid" className="mt-0 border-none p-0 shadow-none">
        <TopCreativesPanel rows={data} currency={currency} />
      </TabsContent>

      <TabsContent value="table" className="mt-0 border-none p-0 shadow-none">
        <MetaCreativesTable rows={data} currency={currency} />
      </TabsContent>
    </Tabs>
  )
}
