import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { SummaryContent } from "./_components/summary-content"

export const metadata = {
  title: "Resumen | Marketing",
  description: "Resumen de gasto Meta y TikTok en COP",
}

export default function ResumenPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-48" />
            <div className="flex flex-col gap-4">
              <Skeleton className="h-4 w-20" />
              <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        }
      >
        <SummaryContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
