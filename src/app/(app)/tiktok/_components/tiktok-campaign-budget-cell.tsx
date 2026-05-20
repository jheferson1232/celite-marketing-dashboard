"use client"

import type { CampaignRow } from "@/lib/services/meta/types"
import { formatCurrency, TIKTOK_DASHBOARD_CURRENCY } from "@/lib/format"
import { TikTokBudgetCell } from "./tiktok-budget-cell"
import { canEditTikTokDailyBudget } from "./tiktok-manage-types"

interface TikTokCampaignBudgetCellProps {
  campaign: CampaignRow
}

export function TikTokCampaignBudgetCell({ campaign }: TikTokCampaignBudgetCellProps) {
  const entity = {
    type: "campaign" as const,
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    operationStatus: campaign.operationStatus,
    dailyBudget: campaign.dailyBudget,
    budgetMode: campaign.budgetMode,
  }

  if (canEditTikTokDailyBudget(entity)) {
    return <TikTokBudgetCell entity={entity} />
  }

  const sum = campaign.adGroupDailyBudgetSum ?? 0
  if (sum > 0) {
    return (
      <div
        className="text-right text-sm tabular-nums text-muted-foreground"
        title="Presupuesto en conjuntos — expande la fila para editar cada uno"
      >
        {formatCurrency(sum, TIKTOK_DASHBOARD_CURRENCY)}
        <span className="mt-0.5 block text-[10px] font-normal">Σ conjuntos</span>
      </div>
    )
  }

  return (
    <div
      className="text-right text-xs text-muted-foreground"
      title="Sin presupuesto diario a nivel campaña. Expande para ver conjuntos."
    >
      —
    </div>
  )
}
