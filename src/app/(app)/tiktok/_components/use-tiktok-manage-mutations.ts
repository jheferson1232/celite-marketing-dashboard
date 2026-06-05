"use client"

import * as React from "react"
import { useServerAction } from "@/lib/server-action"
import {
  setTikTokAdGroupBudgetAction,
  setTikTokAdGroupStatusAction,
  setTikTokCampaignBudgetAction,
  setTikTokCampaignStatusAction,
} from "../_actions/manage"
import { useInvalidateTikTokDashboard } from "./use-invalidate-tiktok-dashboard"
import {
  getTikTokManageEntityKey,
  type TikTokManageEntity,
} from "./tiktok-manage-types"

function removePendingKey(current: Set<string>, key: string): Set<string> {
  const next = new Set(current)
  next.delete(key)
  return next
}

export function useTikTokManageMutations(accountId?: string) {
  const { invalidateAfterManageChange } = useInvalidateTikTokDashboard()
  const [pendingKeys, setPendingKeys] = React.useState<Set<string>>(
    () => new Set()
  )
  const [errorByKey, setErrorByKey] = React.useState<Record<string, string>>({})

  const markPending = React.useCallback((key: string) => {
    setPendingKeys((current) => new Set(current).add(key))
    setErrorByKey((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }, [])

  const clearPending = React.useCallback((key: string) => {
    setPendingKeys((current) => removePendingKey(current, key))
  }, [])

  const setEntityError = React.useCallback((key: string, message: string) => {
    setErrorByKey((current) => ({ ...current, [key]: message }))
  }, [])

  const isEntityPending = React.useCallback(
    (entity: TikTokManageEntity) =>
      pendingKeys.has(getTikTokManageEntityKey(entity)),
    [pendingKeys]
  )

  const getEntityError = React.useCallback(
    (entity: TikTokManageEntity) =>
      errorByKey[getTikTokManageEntityKey(entity)] ?? null,
    [errorByKey]
  )

  const campaignStatusMutation = useServerAction(setTikTokCampaignStatusAction)
  const adGroupStatusMutation = useServerAction(setTikTokAdGroupStatusAction)
  const campaignBudgetMutation = useServerAction(setTikTokCampaignBudgetAction)
  const adGroupBudgetMutation = useServerAction(setTikTokAdGroupBudgetAction)

  const setEntityStatus = React.useCallback(
    (entity: TikTokManageEntity, operationStatus: "ENABLE" | "DISABLE") => {
      const key = getTikTokManageEntityKey(entity)
      markPending(key)

      const settled = () => clearPending(key)

      if (entity.type === "campaign") {
        campaignStatusMutation.mutate(
          { campaignId: entity.id, operationStatus, accountId },
          {
            onSuccess: () => {
              invalidateAfterManageChange({ campaignId: entity.id })
            },
            onError: (error) => setEntityError(key, error.message),
            onSettled: settled,
          }
        )
        return
      }

      adGroupStatusMutation.mutate(
        { adgroupId: entity.id, operationStatus, accountId },
        {
          onSuccess: () => {
            invalidateAfterManageChange({
              campaignId: entity.campaignId,
            })
          },
          onError: (error) => setEntityError(key, error.message),
          onSettled: settled,
        }
      )
    },
    [
      accountId,
      adGroupStatusMutation,
      campaignStatusMutation,
      clearPending,
      invalidateAfterManageChange,
      markPending,
      setEntityError,
    ]
  )

  const setEntityBudget = React.useCallback(
    (entity: TikTokManageEntity, budget: number) => {
      const key = getTikTokManageEntityKey(entity)
      markPending(key)

      const settled = () => clearPending(key)

      if (entity.type === "campaign") {
        campaignBudgetMutation.mutate(
          { campaignId: entity.id, budget, accountId },
          {
            onSuccess: () => {
              invalidateAfterManageChange({ campaignId: entity.id })
            },
            onError: (error) => setEntityError(key, error.message),
            onSettled: settled,
          }
        )
        return
      }

      adGroupBudgetMutation.mutate(
        { adgroupId: entity.id, budget, accountId },
        {
          onSuccess: () => {
            invalidateAfterManageChange({
              campaignId: entity.campaignId,
            })
          },
          onError: (error) => setEntityError(key, error.message),
          onSettled: settled,
        }
      )
    },
    [
      accountId,
      adGroupBudgetMutation,
      campaignBudgetMutation,
      clearPending,
      invalidateAfterManageChange,
      markPending,
      setEntityError,
    ]
  )

  return {
    isEntityPending,
    getEntityError,
    setEntityStatus,
    setEntityBudget,
  }
}
