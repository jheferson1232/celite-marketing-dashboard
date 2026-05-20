"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { CampaignRow } from "@/lib/services/meta/types"
import type { CampaignColumnMeta } from "@/app/(app)/dashboard/_components/campaigns/types"
import { TikTokStatusSwitch } from "./tiktok-status-switch"

function columnMeta(
  label: string,
  align: CampaignColumnMeta["align"] = "right"
): CampaignColumnMeta {
  return { label, align }
}

export function getTikTokCampaignManageColumns(): ColumnDef<CampaignRow>[] {
  return [
    {
      id: "active",
      enableSorting: false,
      enableHiding: false,
      meta: columnMeta("Act.", "left"),
      header: () => (
        <span className="pl-1 text-xs font-medium" title="Activado">
          Act.
        </span>
      ),
      cell: ({ row }) => {
        const campaign = row.original
        if (!campaign.id) return null

        return (
          <div className="flex justify-center pl-1">
            <TikTokStatusSwitch
              entity={{
                type: "campaign",
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                operationStatus: campaign.operationStatus,
                dailyBudget: campaign.dailyBudget,
                budgetMode: campaign.budgetMode,
              }}
            />
          </div>
        )
      },
    },
  ]
}
