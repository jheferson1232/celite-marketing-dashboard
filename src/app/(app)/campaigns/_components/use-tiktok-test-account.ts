"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { listTikTokAdAccountsAction } from "@/app/(app)/tiktok/cuentas/_actions/tiktok-ad-accounts"
import { runServerAction } from "@/lib/server-action"
import {
  resolveTikTokAccountCurrency,
  tikTokAccountCurrencyLabel,
} from "@/lib/services/tiktok/account-currency"
import type { TikTokAdAccountSummary } from "@/lib/services/tiktok/ad-accounts"
import type { CurrencyCode } from "@/lib/format"

function pickTestAccount(
  accounts: TikTokAdAccountSummary[]
): TikTokAdAccountSummary | null {
  return (
    accounts.find((account) => account.isDefaultForTests) ??
    accounts.find((account) => account.isDefault) ??
    accounts[0] ??
    null
  )
}

/** Cuenta marcada como default de testeos y su moneda (COP, PEN o MXN). */
export function useTikTokTestAccount() {
  const accountsQuery = useQuery({
    queryKey: ["tiktok-ad-accounts"],
    queryFn: () => runServerAction(listTikTokAdAccountsAction()),
    staleTime: 0,
    refetchOnMount: "always",
  })

  const account = useMemo(
    () => pickTestAccount(accountsQuery.data ?? []),
    [accountsQuery.data]
  )

  const currency: CurrencyCode | null = account
    ? resolveTikTokAccountCurrency(account.currency)
    : null

  return {
    account,
    currency,
    currencyLabel: currency ? tikTokAccountCurrencyLabel(currency) : "…",
    isLoading: accountsQuery.isLoading && !accountsQuery.data,
  }
}
