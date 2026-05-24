import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { PRODUCT_STATUS_VALUES } from "@/lib/products/status"
import { ProductsKanbanContent } from "./_components/products-kanban-content"

export const metadata = {
  title: "Products Kanban | Marketing",
  description: "Tablero Kanban para gestionar el estado de productos",
}

export default function ProductsKanbanPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-56" />
            <div className="flex gap-4 overflow-x-auto pb-2">
              {PRODUCT_STATUS_VALUES.map((status) => (
                <Skeleton
                  key={status}
                  className="h-[420px] min-w-[260px] flex-1 rounded-xl"
                />
              ))}
            </div>
          </div>
        }
      >
        <ProductsKanbanContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
