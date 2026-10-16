"use client"

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { runServerAction } from "@/lib/server-action"
import { cn } from "@/lib/utils"
import type { MetaAdAccountSummary } from "@/lib/services/meta/meta-ad-accounts"
import { listMetaAdAccountsAction } from "../_actions/meta-ad-accounts"

const STORAGE_KEY = "meta-dashboard-account:v1"

const MetaDashboardAccountContext = createContext<string | null>(null)

export function MetaDashboardAccountProvider({
  accountId,
  children,
}: {
  accountId: string | null
  children: React.ReactNode
}) {
  return (
    <MetaDashboardAccountContext value={accountId}>
      {children}
    </MetaDashboardAccountContext>
  )
}

export function useMetaDashboardAccountId() {
  return use(MetaDashboardAccountContext)
}

function pickInitialAccountId(accounts: MetaAdAccountSummary[]): string | null {
  if (accounts.length === 0) return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && accounts.some((account) => account.accountId === stored)) {
      return stored
    }
  } catch {
    // private browsing / disabled storage
  }

  return (
    accounts.find((account) => account.isDefault)?.accountId ??
    accounts[0]?.accountId ??
    null
  )
}

function accountOptionLabel(account: MetaAdAccountSummary): string {
  return account.statusLabel
    ? `${account.name} · ${account.statusLabel}`
    : account.name
}

export function useMetaDashboardAccount() {
  const accountsQuery = useQuery({
    queryKey: ["meta-ad-accounts"],
    queryFn: () => runServerAction(listMetaAdAccountsAction()),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const accounts = accountsQuery.data ?? []
  const [accountId, setAccountIdState] = useState<string | null>(null)

  useEffect(() => {
    if (accountsQuery.isLoading || accounts.length === 0) return
    setAccountIdState((current) => {
      if (current && accounts.some((account) => account.accountId === current)) {
        return current
      }
      return pickInitialAccountId(accounts)
    })
  }, [accounts, accountsQuery.isLoading])

  const setAccountId = useCallback((nextId: string) => {
    setAccountIdState(nextId)
    try {
      localStorage.setItem(STORAGE_KEY, nextId)
    } catch {
      // ignore
    }
  }, [])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.accountId === accountId) ?? null,
    [accounts, accountId]
  )

  return {
    accounts,
    accountId,
    setAccountId,
    selectedAccount,
    isLoading: accountsQuery.isLoading,
    error: accountsQuery.error,
  }
}

export function MetaAccountSelect({
  accounts,
  value,
  onChange,
  disabled = false,
  className,
}: {
  accounts: MetaAdAccountSummary[]
  value: string | null
  onChange: (accountId: string) => void
  disabled?: boolean
  className?: string
}) {
  if (accounts.length === 0) return null

  return (
    <select
      id="meta-dashboard-account"
      aria-label="Cuenta de Meta"
      title="Cuenta de Meta"
      className={cn(
        "border-input bg-background h-8 max-w-[16rem] truncate rounded-md border px-2 text-xs shadow-xs",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      value={value ?? ""}
      disabled={disabled || !value}
      onChange={(event) => {
        const nextId = event.target.value
        if (nextId) onChange(nextId)
      }}
    >
      {accounts.map((account) => (
        <option key={account.accountId} value={account.accountId}>
          {accountOptionLabel(account)}
        </option>
      ))}
    </select>
  )
}
