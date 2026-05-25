import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductsContent } from "./_components/catalog/products-content"

export const metadata = {
  title: "Products | Marketing",
  description: "Catálogo de productos",
}

export default function ProductsPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[4/5] w-full rounded-xl" />
              ))}
            </div>
          </div>
        }
      >
        <ProductsContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
