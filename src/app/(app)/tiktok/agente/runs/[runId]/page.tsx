import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { TikTokAgentRunDetail } from "./_components/tiktok-agent-run-detail"

export const metadata = {
  title: "Detalle corrida · Agente TikTok | Marketing",
}

interface PageProps {
  params: Promise<{ runId: string }>
}

export default async function TikTokAgentRunPage({ params }: PageProps) {
  const { runId } = await params

  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="p-6 lg:p-8">
            <Skeleton className="h-8 w-48" />
          </div>
        }
      >
        <TikTokAgentRunDetail runId={runId} />
      </Suspense>
    </AppPageScrollShell>
  )
}
