import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { CAMPAIGN_KANBAN_STATUS_VALUES } from "@/lib/campaigns/status"
import { CampaignsKanbanContent } from "./_components/campaigns-kanban-content"

export const metadata = {
  title: "Campaigns | Marketing",
  description: "Tablero Kanban para gestionar campañas TikTok",
}

export default function CampaignsPage() {
  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-56" />
            <div className="flex gap-4 overflow-x-auto pb-2">
              {CAMPAIGN_KANBAN_STATUS_VALUES.map((status) => (
                <Skeleton
                  key={status}
                  className="h-[420px] w-[280px] shrink-0 rounded-xl"
                />
              ))}
            </div>
          </div>
        }
      >
        <CampaignsKanbanContent />
      </Suspense>
    </AppPageScrollShell>
  )
}
