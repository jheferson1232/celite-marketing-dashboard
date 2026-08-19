"use client"

import type { CampaignRow } from "@/lib/services/meta/types"
import type { CurrencyCode } from "@/lib/format"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TikTokCampaignDetailsContent } from "@/app/(app)/tiktok/_components/tiktok-campaign-details-content"
import { MetaCampaignDetailsContent } from "./meta-campaign-details-content"

interface CampaignDetailsSheetProps {
  campaign: CampaignRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  platform?: "meta" | "tiktok"
  currency?: CurrencyCode
}

export function CampaignDetailsSheet({
  campaign,
  open,
  onOpenChange,
  platform = "meta",
  currency,
}: CampaignDetailsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="pr-8">{campaign?.name ?? "Campaña"}</SheetTitle>
          {platform === "tiktok" ? (
            <SheetDescription>
              Rendimiento de los últimos 7 días en TikTok Ads
            </SheetDescription>
          ) : (
            <SheetDescription>
              Rendimiento de los últimos 7 días en Meta Ads
            </SheetDescription>
          )}
        </SheetHeader>

        {platform === "tiktok" && campaign?.id ? (
          <TikTokCampaignDetailsContent
            campaignId={campaign.id}
            accountId={campaign.tiktokAccountId}
            currency={currency}
          />
        ) : platform === "meta" && campaign?.id ? (
          <MetaCampaignDetailsContent
            campaignId={campaign.id}
            objective={campaign.objective ?? ""}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
