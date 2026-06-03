import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { TikTokAgenteContent } from "./_components/tiktok-agente-content"

export const maxDuration = 300

export const metadata = {
  title: "Agente automático · TikTok | Marketing",
  description:
    "Agente automático TikTok Ads: umbrales, corridas y pausas programadas",
}

export default function TikTokAgentePage() {
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
        <TikTokAgenteContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
