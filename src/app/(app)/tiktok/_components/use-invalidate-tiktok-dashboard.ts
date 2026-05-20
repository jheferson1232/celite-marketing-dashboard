"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { runServerAction } from "@/lib/server-action"
import { clearTikTokCacheAction } from "../_actions/clear-tiktok-cache"

function isTikTokQueryKey(key: string): boolean {
  return (
    key.startsWith("tiktok-account-kpis") ||
    key.startsWith("tiktok-campaigns") ||
    key.startsWith("tiktok-ad-insights") ||
    key.startsWith("tiktok-campaign-adgroups") ||
    key.startsWith("tiktok-campaign-daily-insights")
  )
}

export function useInvalidateTikTokDashboard() {
  const queryClient = useQueryClient()

  const invalidateAll = useCallback(async () => {
    await runServerAction(clearTikTokCacheAction())
    await queryClient.invalidateQueries({
      predicate: (query) => isTikTokQueryKey(String(query.queryKey[0])),
    })
  }, [queryClient])

  /** Tras pausar/activar o cambiar presupuesto: solo campañas y conjuntos (no bloquea todo el dashboard). */
  const invalidateAfterManageChange = useCallback(
    (options?: { campaignId?: string }) => {
      void (async () => {
        await runServerAction(clearTikTokCacheAction())
        await queryClient.invalidateQueries({
          queryKey: ["tiktok-campaigns"],
          refetchType: "active",
        })
        if (options?.campaignId) {
          await queryClient.invalidateQueries({
            predicate: (query) =>
              query.queryKey[0] === "tiktok-campaign-adgroups" &&
              query.queryKey[1] === options.campaignId,
            refetchType: "active",
          })
        } else {
          await queryClient.invalidateQueries({
            queryKey: ["tiktok-campaign-adgroups"],
            refetchType: "active",
          })
        }
      })()
    },
    [queryClient]
  )

  return { invalidateAll, invalidateAfterManageChange }
}
