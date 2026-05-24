import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductsContent } from "../products/_components/catalog/products-content"

export const metadata = {
  title: "Productos | Marketing",
  description: "Catálogo de productos con historial de ventas y campañas",
}

export default function ProductoPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[4/5] w-full rounded-xl" />
              ))}
            </div>
          </div>
        }
      >
        <ProductsContent basePath="/producto" />
      </Suspense>
    </AppPageScrollShell>
  )
}
