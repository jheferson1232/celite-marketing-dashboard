"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { runServerAction, useServerAction } from "@/lib/server-action"
import { listPendingActivateCampaignsAction } from "../_actions/pending-6am"
import {
  duplicateTikTokAdGroupAction,
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
  const queryClient = useQueryClient()
  const { invalidateAfterManageChange } = useInvalidateTikTokDashboard()
  const [pendingKeys, setPendingKeys] = React.useState<Set<string>>(
    () => new Set()
  )
  const [errorByKey, setErrorByKey] = React.useState<Record<string, string>>({})
  const [infoByKey, setInfoByKey] = React.useState<Record<string, string>>({})
  const [queuedCampaignIds, setQueuedCampaignIds] = React.useState<Set<string>>(
    () => new Set()
  )

  const pending6amQuery = useQuery({
    queryKey: ["tiktok-pending-activate-6am"],
    queryFn: () => runServerAction(listPendingActivateCampaignsAction()),
    staleTime: 30_000,
  })

  React.useEffect(() => {
    if (!pending6amQuery.data) return
    setQueuedCampaignIds(
      new Set(pending6amQuery.data.map((item) => item.campaignId))
    )
  }, [pending6amQuery.data])

  const markPending = React.useCallback((key: string) => {
    setPendingKeys((current) => new Set(current).add(key))
    setErrorByKey((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setInfoByKey((current) => {
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

  const setEntityInfo = React.useCallback((key: string, message: string) => {
    setInfoByKey((current) => ({ ...current, [key]: message }))
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

  const getEntityInfo = React.useCallback(
    (entity: TikTokManageEntity) =>
      infoByKey[getTikTokManageEntityKey(entity)] ?? null,
    [infoByKey]
  )

  const isCampaignQueuedFor6am = React.useCallback(
    (campaignId: string) => queuedCampaignIds.has(campaignId),
    [queuedCampaignIds]
  )

  const campaignStatusMutation = useServerAction(setTikTokCampaignStatusAction)
  const adGroupStatusMutation = useServerAction(setTikTokAdGroupStatusAction)
  const campaignBudgetMutation = useServerAction(setTikTokCampaignBudgetAction)
  const adGroupBudgetMutation = useServerAction(setTikTokAdGroupBudgetAction)
  const duplicateAdGroupMutation = useServerAction(duplicateTikTokAdGroupAction)

  const duplicateKey = React.useCallback(
    (adgroupId: string) => `duplicate:adgroup:${adgroupId}`,
    []
  )

  const isDuplicatingAdGroup = React.useCallback(
    (adgroupId: string) => pendingKeys.has(duplicateKey(adgroupId)),
    [duplicateKey, pendingKeys]
  )

  const getDuplicateError = React.useCallback(
    (adgroupId: string) => errorByKey[duplicateKey(adgroupId)] ?? null,
    [duplicateKey, errorByKey]
  )

  const getDuplicateInfo = React.useCallback(
    (adgroupId: string) => infoByKey[duplicateKey(adgroupId)] ?? null,
    [duplicateKey, infoByKey]
  )

  const duplicateAdGroup = React.useCallback(
    (input: { adgroupId: string; campaignId?: string }) => {
      const key = duplicateKey(input.adgroupId)
      markPending(key)
      duplicateAdGroupMutation.mutate(
        { adgroupId: input.adgroupId, accountId },
        {
          onSuccess: (result) => {
            setEntityInfo(
              key,
              result?.message ??
                `Duplicado: «${result?.newAdgroupName ?? "copia"}»`
            )
            invalidateAfterManageChange({ campaignId: input.campaignId })
          },
          onError: (error) => setEntityError(key, error.message),
          onSettled: () => clearPending(key),
        }
      )
    },
    [
      accountId,
      clearPending,
      duplicateAdGroupMutation,
      duplicateKey,
      invalidateAfterManageChange,
      markPending,
      setEntityError,
      setEntityInfo,
    ]
  )

  const setEntityStatus = React.useCallback(
    (entity: TikTokManageEntity, operationStatus: "ENABLE" | "DISABLE") => {
      const key = getTikTokManageEntityKey(entity)
      markPending(key)

      const settled = () => clearPending(key)

      if (entity.type === "campaign") {
        campaignStatusMutation.mutate(
          {
            campaignId: entity.id,
            campaignName: entity.name,
            operationStatus,
            accountId,
          },
          {
            onSuccess: (result) => {
              if (result?.scheduledFor6am) {
                setQueuedCampaignIds((current) =>
                  new Set(current).add(entity.id)
                )
                setEntityInfo(
                  key,
                  result.message ?? "Se activará a las 6:00 AM"
                )
                void queryClient.invalidateQueries({
                  queryKey: ["tiktok-pending-activate-6am"],
                })
                return
              }
              if (operationStatus === "DISABLE") {
                setQueuedCampaignIds((current) => {
                  const next = new Set(current)
                  next.delete(entity.id)
                  return next
                })
                void queryClient.invalidateQueries({
                  queryKey: ["tiktok-pending-activate-6am"],
                })
              }
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
      queryClient,
      setEntityError,
      setEntityInfo,
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
    getEntityInfo,
    isCampaignQueuedFor6am,
    isDuplicatingAdGroup,
    getDuplicateError,
    getDuplicateInfo,
    duplicateAdGroup,
    setEntityStatus,
    setEntityBudget,
  }
}
