"use client"

import { RiFacebookCircleFill, RiTiktokFill } from "@remixicon/react"
import { CampaignsTable } from "@/app/(app)/dashboard/_components/campaigns"
import {
  META_CAMPAIGNS_COLUMN_VISIBILITY_KEY,
  META_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY,
  TIKTOK_CAMPAIGNS_COLUMN_VISIBILITY_KEY,
  TIKTOK_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY,
} from "@/app/(app)/dashboard/_components/campaigns/use-persisted-column-visibility"
import { getCampaignAdSets } from "@/app/(app)/dashboard/_actions/campaign-adsets"
import { getTikTokCampaignAdGroups } from "@/app/(app)/tiktok/_actions/campaign-adgroups"
import { TikTokManageProvider } from "@/app/(app)/tiktok/_components/tiktok-manage-provider"
import {
  META_DASHBOARD_CURRENCY,
  TIKTOK_DASHBOARD_CURRENCY,
} from "@/lib/format"
import type { CampaignAdSetRow, CampaignRow } from "@/lib/services/meta/types"
import { useProductoPlatformFilter } from "../../_lib/use-producto-platform-filter"

interface ProductoLinkedCampaignsTableProps {
  campaignCount: number
  tiktokCampaigns: CampaignRow[]
  metaCampaigns: CampaignRow[]
  isLoading: boolean
  tiktokAdSetsByCampaignId?: Record<string, CampaignAdSetRow[]>
}

export function ProductoLinkedCampaignsTable({
  campaignCount,
  tiktokCampaigns,
  metaCampaigns,
  isLoading,
  tiktokAdSetsByCampaignId,
}: ProductoLinkedCampaignsTableProps) {
  const { platformFilter } = useProductoPlatformFilter()

  if (campaignCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Vincula campañas para ver la tabla de métricas.
      </p>
    )
  }

  const showTikTok = platformFilter === "all" || platformFilter === "tiktok"
  const showMeta = platformFilter === "all" || platformFilter === "meta"

  return (
    <div className="min-w-0 space-y-6">
      {showTikTok ? (
        <section className="min-w-0">
          {platformFilter === "all" ? (
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
              <RiTiktokFill className="size-4" />
              TikTok
              {tiktokCampaigns.length > 0 ? (
                <span className="text-xs font-normal text-muted-foreground">
                  ({tiktokCampaigns.length})
                </span>
              ) : null}
            </div>
          ) : null}
          {tiktokCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay campañas TikTok vinculadas.
            </p>
          ) : (
            <TikTokManageProvider currency={TIKTOK_DASHBOARD_CURRENCY}>
              <CampaignsTable
                data={tiktokCampaigns}
                isLoading={isLoading}
                currency={TIKTOK_DASHBOARD_CURRENCY}
                adSetsQueryKeyPrefix="tiktok-campaign-adgroups"
                fetchCampaignAdSets={getTikTokCampaignAdGroups}
                enableTikTokManage
                tikTokAdSetsByCampaignId={tiktokAdSetsByCampaignId}
                columnVisibilityStorageKey={
                  TIKTOK_CAMPAIGNS_COLUMN_VISIBILITY_KEY
                }
                defaultColumnVisibility={
                  TIKTOK_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY
                }
              />
            </TikTokManageProvider>
          )}
        </section>
      ) : null}

      {showMeta ? (
        <section className="min-w-0">
          {platformFilter === "all" ? (
            <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
              <RiFacebookCircleFill className="size-4 text-blue-600" />
              Meta
              {metaCampaigns.length > 0 ? (
                <span className="text-xs font-normal text-muted-foreground">
                  ({metaCampaigns.length})
                </span>
              ) : null}
            </div>
          ) : null}
          {metaCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay campañas Meta vinculadas.
            </p>
          ) : (
            <CampaignsTable
              data={metaCampaigns}
              isLoading={isLoading}
              currency={META_DASHBOARD_CURRENCY}
              adSetsQueryKeyPrefix="campaign-adsets"
              fetchCampaignAdSets={getCampaignAdSets}
              enableMetaExtendedMetrics
              columnVisibilityStorageKey={META_CAMPAIGNS_COLUMN_VISIBILITY_KEY}
              defaultColumnVisibility={META_CAMPAIGNS_DEFAULT_COLUMN_VISIBILITY}
            />
          )}
        </section>
      ) : null}
    </div>
  )
}
