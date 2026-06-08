import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { MetaCommentProductsList } from "./_components/products-list"

export const metadata = {
  title: "Productos · Comentarios IA",
}

export default function MetaCommentProductsPage() {
  return (
    <AppPageScrollShell>
      <Suspense fallback={<Skeleton className="m-8 h-48 rounded-2xl" />}>
        <MetaCommentProductsList />
      </Suspense>
    </AppPageScrollShell>
  )
}
