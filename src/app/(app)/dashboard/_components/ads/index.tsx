"use client"

import * as React from "react"
import {
  META_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import type { AdInsightRow } from "@/lib/services/meta/types"
import { TopCreativesPanel } from "./top-creatives-panel"
import { CreativeAdsTable } from "./creatives-table"
import { MetaCreativesTable } from "./meta-creatives-table"
import { TIKTOK_DASHBOARD_CURRENCY } from "@/lib/format"
import { AdsGridSkeleton } from "./ads-grid-skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RiLayoutGridLine, RiListCheck2 } from "@remixicon/react"

interface AdsViewProps {
  data?: AdInsightRow[]
  isLoading: boolean
  currency?: CurrencyCode
}

function AdsEmptyState() {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed">
      <p className="text-sm text-muted-foreground">
        No se encontraron anuncios con gasto en el periodo seleccionado.
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

  if (!data?.length) {
    return <AdsEmptyState />
  }

  return (
    <Tabs defaultValue="grid" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Creativos</h2>
        <TabsList>
          <TabsTrigger value="grid" className="gap-2">
            <RiLayoutGridLine className="size-4" />
            Cards
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-2">
            <RiListCheck2 className="size-4" />
            Tabla
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="grid" className="mt-0 border-none p-0 shadow-none">
        <TopCreativesPanel rows={data} currency={currency} />
      </TabsContent>

      <TabsContent value="table" className="mt-0 border-none p-0 shadow-none">
        {currency === TIKTOK_DASHBOARD_CURRENCY ? (
          <CreativeAdsTable rows={data} currency={currency} />
        ) : (
          <MetaCreativesTable rows={data} />
        )}
      </TabsContent>
    </Tabs>
  )
}
