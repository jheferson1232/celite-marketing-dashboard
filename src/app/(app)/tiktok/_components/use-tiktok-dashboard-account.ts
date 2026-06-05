"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import type { TikTokAdAccountSummary } from "@/lib/services/tiktok/ad-accounts"
import { listTikTokAdAccountsAction } from "../cuentas/_actions/tiktok-ad-accounts"
import { TIKTOK_DASHBOARD_ACCOUNT_STORAGE_KEY } from "../_lib/tiktok-dashboard-account-storage"

function pickInitialAccountId(
  accounts: TikTokAdAccountSummary[]
): string | null {
  if (accounts.length === 0) return null

  try {
    const stored = localStorage.getItem(TIKTOK_DASHBOARD_ACCOUNT_STORAGE_KEY)
    if (stored && accounts.some((account) => account.id === stored)) {
      return stored
    }
  } catch {
    // private browsing / disabled storage
  }

  const testDefault = accounts.find((account) => account.isDefaultForTests)
  return testDefault?.id ?? accounts[0]?.id ?? null
}

export function useTikTokDashboardAccount() {
  const accountsQuery = useQuery({
    queryKey: ["tiktok-ad-accounts"],
    queryFn: () => runServerAction(listTikTokAdAccountsAction()),
    staleTime: 60 * 1000,
  })

  const accounts = accountsQuery.data ?? []
  const [accountId, setAccountIdState] = useState<string | null>(null)

  useEffect(() => {
    if (accountsQuery.isLoading || accounts.length === 0) return
    setAccountIdState((current) => {
      if (current && accounts.some((account) => account.id === current)) {
        return current
      }
      return pickInitialAccountId(accounts)
    })
  }, [accounts, accountsQuery.isLoading])

  const setAccountId = useCallback((nextId: string) => {
    setAccountIdState(nextId)
    try {
      localStorage.setItem(TIKTOK_DASHBOARD_ACCOUNT_STORAGE_KEY, nextId)
    } catch {
      // ignore
    }
  }, [])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accounts, accountId]
  )

  return {
    accounts,
    accountId,
    setAccountId,
    selectedAccount,
    isLoading: accountsQuery.isLoading,
  }
}
