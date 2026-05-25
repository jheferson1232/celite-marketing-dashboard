import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { BaulContent } from "./_components/baul-content"

export const metadata = {
  title: "Baúl | Marketing",
  description: "Biblioteca centralizada de imágenes y videos",
}

export default function BaulPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square w-full rounded-xl" />
              ))}
            </div>
          </div>
        }
      >
        <BaulContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
