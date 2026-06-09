import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { MetaLibraryDetailContent } from "../_components/meta-library-detail-content"

export const metadata = {
  title: "Detalle Meta Library | Marketing",
}

export default async function MetaLibraryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        }
      >
        <MetaLibraryDetailContent entryId={id} />
      </Suspense>
    </AppPageScrollShell>
  )
}
