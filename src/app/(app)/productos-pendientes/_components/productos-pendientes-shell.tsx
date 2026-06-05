"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RiShoppingBag3Line, RiStore2Line } from "@remixicon/react"
import { ProductosPendientesContent } from "./productos-pendientes-content"
import { TiendasPendientesContent } from "./tiendas-pendientes-content"

export function ProductosPendientesShell({
  creditsHint,
}: {
  creditsHint: string
}) {
  return (
    <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
      <Tabs defaultValue="productos" className="min-w-0 w-full">
        <TabsList className="mb-2 w-full sm:w-fit">
          <TabsTrigger value="productos" className="flex-1 gap-2 sm:flex-none">
            <RiShoppingBag3Line className="size-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="tiendas" className="flex-1 gap-2 sm:flex-none">
            <RiStore2Line className="size-4" />
            Tiendas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="mt-0 outline-none">
          <ProductosPendientesContent creditsHint={creditsHint} embedded />
        </TabsContent>

        <TabsContent value="tiendas" className="mt-0 outline-none">
          <TiendasPendientesContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}
