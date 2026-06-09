import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { MetaLibraryContent } from "./_components/meta-library-content"

export const metadata = {
  title: "Meta Library | Marketing",
  description:
    "Registro manual de URLs y páginas de Facebook para seguimiento en Meta Ad Library",
}

export default function MetaLibraryPage() {
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
        <MetaLibraryContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
