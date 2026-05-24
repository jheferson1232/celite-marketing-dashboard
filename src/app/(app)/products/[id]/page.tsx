import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductEditContent } from "../_components/edit/product-edit-content"

interface ProductIdPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ProductIdPageProps) {
  const { id } = await params
  return {
    title: `Editar producto ${id.slice(0, 8)}… | Marketing`,
    description: "Editar detalles, imágenes y videos del producto",
  }
}

export default async function ProductIdPage({ params }: ProductIdPageProps) {
  const { id } = await params

  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-full max-w-xl" />
            <Skeleton className="h-24 w-full max-w-xl" />
            <Skeleton className="h-48 w-full" />
          </div>
        }
      >
        <ProductEditContent productId={id} />
      </Suspense>
    </AppPageScrollShell>
  )
}
