import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { BufferContent } from "./_components/buffer-content"

export const metadata = {
  title: "Buffer | Marketing",
  description: "Canales y publicaciones de Buffer",
}

export default function BufferPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        }
      >
        <BufferContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
