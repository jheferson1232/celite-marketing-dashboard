"use client"

import * as React from "react"
import { useTikTokManageMutations } from "./use-tiktok-manage-mutations"

type TikTokManageContextValue = ReturnType<typeof useTikTokManageMutations>

const TikTokManageContext = React.createContext<TikTokManageContextValue | null>(
  null
)

export function TikTokManageProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const value = useTikTokManageMutations()
  return (
    <TikTokManageContext.Provider value={value}>
      {children}
    </TikTokManageContext.Provider>
  )
}

export function useTikTokManage() {
  const context = React.useContext(TikTokManageContext)
  if (!context) {
    throw new Error("useTikTokManage debe usarse dentro de TikTokManageProvider")
  }
  return context
}
