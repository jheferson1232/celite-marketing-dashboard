import type { CampaignEntityStatus } from "@/lib/services/meta/types"
import { isTikTokEditableDailyBudget } from "@/lib/services/tiktok/budget-mode"

export type TikTokManageEntity =
  | {
      type: "campaign"
      id: string
      name: string
      status: CampaignEntityStatus
      operationStatus?: "ENABLE" | "DISABLE"
      dailyBudget?: number | null
      budgetMode?: string | null
    }
  | {
      type: "adgroup"
      id: string
      name: string
      status: CampaignEntityStatus
      campaignId?: string
      dailyBudget?: number | null
      budgetMode?: string | null
    }

export function getTikTokEntityIsActive(entity: TikTokManageEntity): boolean {
  if (entity.type === "campaign") {
    return (
      (entity.operationStatus ??
        (entity.status === "ACTIVE" ? "ENABLE" : "DISABLE")) === "ENABLE"
    )
  }
  return entity.status === "ACTIVE"
}

export function canEditTikTokDailyBudget(entity: TikTokManageEntity): boolean {
  return isTikTokEditableDailyBudget(entity.budgetMode)
}

export function getTikTokManageEntityKey(entity: TikTokManageEntity): string {
  return `${entity.type}:${entity.id}`
}
