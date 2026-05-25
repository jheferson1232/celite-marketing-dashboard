import { Suspense } from "react"
import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { Skeleton } from "@/components/ui/skeleton"
import { CampaignDetailContent } from "../_components/campaign-detail-content"

interface CampaignIdPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: CampaignIdPageProps) {
  const { id } = await params
  return {
    title: `Campaña ${id.slice(0, 8)}… | Marketing`,
    description: "Configurar campaña TikTok",
  }
}

export default async function CampaignIdPage({ params }: CampaignIdPageProps) {
  const { id } = await params

  return (
    <AppPageScrollShell>
      <Suspense
        fallback={
          <div className="flex w-full flex-col gap-6 p-6 lg:p-8">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-full max-w-xl" />
            <Skeleton className="h-64 w-full max-w-2xl" />
          </div>
        }
      >
        <CampaignDetailContent campaignId={id} />
      </Suspense>
    </AppPageScrollShell>
  )
}
