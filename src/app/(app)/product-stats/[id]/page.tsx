import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductoDetailContent } from "../_components/detail/producto-detail-content"

interface ProductStatsIdPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProductStatsIdPageProps) {
  const { id } = await params
  return {
    title: `Estadísticas ${id.slice(0, 8)}… | Marketing`,
    description: "Estadísticas del producto con historial y campañas",
  }
}

export default async function ProductStatsIdPage({ params }: ProductStatsIdPageProps) {
  const { id } = await params

  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-32" />
            <div className="flex gap-4">
              <Skeleton className="size-32 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-96 w-full rounded-lg" />
          </div>
        }
      >
        <ProductoDetailContent productId={id} />
      </Suspense>
    </AppPageScrollShell>
  )
}
