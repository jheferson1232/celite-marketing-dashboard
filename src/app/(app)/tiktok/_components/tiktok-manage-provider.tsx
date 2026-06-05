"use client"

import * as React from "react"
import {
  TIKTOK_DASHBOARD_CURRENCY,
  type CurrencyCode,
} from "@/lib/format"
import { useTikTokManageMutations } from "./use-tiktok-manage-mutations"

type TikTokManageContextValue = ReturnType<typeof useTikTokManageMutations> & {
  currency: CurrencyCode
}

const TikTokManageContext = React.createContext<TikTokManageContextValue | null>(
  null
)

export function TikTokManageProvider({
  accountId,
  currency,
  children,
}: {
  accountId?: string | null
  currency: CurrencyCode
  children: React.ReactNode
}) {
  const mutations = useTikTokManageMutations(accountId ?? undefined)
  const value = React.useMemo(
    () => ({ ...mutations, currency }),
    [mutations, currency]
  )
  return (
    <TikTokManageContext.Provider value={value}>
      {children}
    </TikTokManageContext.Provider>
  )
}

export function useTikTokDashboardCurrency(): CurrencyCode {
  const context = React.useContext(TikTokManageContext)
  return context?.currency ?? TIKTOK_DASHBOARD_CURRENCY
}

export function useTikTokManage() {
  const context = React.useContext(TikTokManageContext)
  if (!context) {
    throw new Error("useTikTokManage debe usarse dentro de TikTokManageProvider")
  }
  return context
}
