"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo } from "react"
import { getCampaignsList } from "@/app/(app)/dashboard/_actions/campaigns-list"
import { getTikTokCampaignsListAction } from "@/app/(app)/tiktok/_actions/campaigns-list"
import { runServerAction } from "@/lib/server-action"
import type { ProductPlatform, ProductRecord } from "@/lib/services/product"
import { getLastSevenDaysRange } from "@/lib/services/tiktok/campaign-daily-insights.shared"
import {
  linkProductCampaignAction,
  unlinkProductCampaignAction,
} from "../_actions/product-campaigns"

interface UseProductoCampaignLinksOptions {
  product: ProductRecord
  enabled?: boolean
}

export function useProductoCampaignLinks({
  product,
  enabled = true,
}: UseProductoCampaignLinksOptions) {
  const queryClient = useQueryClient()
  const dateRange = getLastSevenDaysRange()

  const { data: tiktokCampaigns = [] } = useQuery({
    queryKey: ["tiktok-campaigns", dateRange],
    queryFn: () => runServerAction(getTikTokCampaignsListAction({ dateRange })),
    enabled,
    staleTime: 2 * 60 * 1000,
  })

  const { data: metaCampaigns = [] } = useQuery({
    queryKey: ["meta-campaigns", dateRange],
    queryFn: () => runServerAction(getCampaignsList(dateRange)),
    enabled,
    staleTime: 2 * 60 * 1000,
  })

  const invalidateProducts = () => {
    void queryClient.invalidateQueries({ queryKey: ["products"] })
    void queryClient.invalidateQueries({
      queryKey: ["product", product.id],
    })
    void queryClient.invalidateQueries({
      queryKey: ["product-sales-history"],
    })
  }

  const linkCampaignMutation = useMutation({
    mutationFn: (input: {
      campaignId: string
      campaignName: string
      platform: ProductPlatform
    }) =>
      runServerAction(
        linkProductCampaignAction({
          productId: product.id,
          campaignId: input.campaignId,
          campaignName: input.campaignName,
          platform: input.platform,
        })
      ),
    onSuccess: invalidateProducts,
  })

  const unlinkCampaignMutation = useMutation({
    mutationFn: (input: { campaignId: string; platform: ProductPlatform }) =>
      runServerAction(
        unlinkProductCampaignAction({
          productId: product.id,
          campaignId: input.campaignId,
          platform: input.platform,
        })
      ),
    onSuccess: invalidateProducts,
  })

  const linkedByPlatform = useMemo(() => {
    const tiktok = new Set<string>()
    const meta = new Set<string>()
    for (const link of product.campaigns) {
      if (link.platform === "meta") meta.add(link.campaignId)
      else tiktok.add(link.campaignId)
    }
    return { tiktok, meta }
  }, [product.campaigns])

  const availableTikTokCampaigns = useMemo(
    () => tiktokCampaigns.filter((c) => !linkedByPlatform.tiktok.has(c.id)),
    [tiktokCampaigns, linkedByPlatform.tiktok]
  )

  const availableMetaCampaigns = useMemo(
    () => metaCampaigns.filter((c) => !linkedByPlatform.meta.has(c.id)),
    [metaCampaigns, linkedByPlatform.meta]
  )

  return {
    availableTikTokCampaigns,
    availableMetaCampaigns,
    tiktokCampaigns,
    metaCampaigns,
    linkCampaign: linkCampaignMutation.mutate,
    unlinkCampaign: unlinkCampaignMutation.mutate,
    isLinking: linkCampaignMutation.isPending,
    isUnlinking: unlinkCampaignMutation.isPending,
  }
}
