import { AppPageScrollShell } from "@/components/app-page-scroll-shell"
import { CampaignCreateContent } from "../_components/campaign-create-content"

export const metadata = {
  title: "Nueva campaña | Marketing",
  description: "Crear campaña TikTok",
}

export default function CampaignNewPage() {
  return (
    <AppPageScrollShell>
      <CampaignCreateContent />
    </AppPageScrollShell>
  )
}
