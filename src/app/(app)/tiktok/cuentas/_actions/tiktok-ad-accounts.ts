"use server"

import { createServerAction } from "@/lib/server-action"
import {
  connectTikTokAdAccount,
  connectTikTokAdAccountsFromAuthCode,
  disconnectTikTokAdAccount,
  getTikTokEnvAccountSummary,
  importTikTokEnvAccount,
  listTikTokAdAccounts,
  refreshAllTikTokAdAccountStatuses,
  refreshTikTokAdAccountMetadata,
  setDefaultTikTokAdAccount,
  setDefaultTikTokAdAccountForTests,
} from "@/lib/services/tiktok/ad-accounts"
import { getTikTokAdAccountsHealth } from "@/lib/services/tiktok/account-health"
import { clearTikTokCache } from "@/lib/services/tiktok/tiktok-cache"
import {
  getTikTokOAuthRedirectUri,
  isTikTokOAuthConfigured,
} from "@/lib/services/tiktok/tiktok-oauth.server"

export const getTikTokOAuthStatusAction = createServerAction(async () => ({
  configured: isTikTokOAuthConfigured(),
  redirectUri: getTikTokOAuthRedirectUri(),
}))

export const connectTikTokWithAuthCodeAction = createServerAction(
  async (authCode: string) => {
    const connected = await connectTikTokAdAccountsFromAuthCode(authCode)
    clearTikTokCache()
    return {
      count: connected.length,
      accounts: connected.map((account) => ({
        id: account.id,
        name: account.name,
        advertiserId: account.advertiserId,
      })),
    }
  }
)

export const listTikTokAdAccountsAction = createServerAction(async () =>
  listTikTokAdAccounts()
)

export const getTikTokEnvAccountSummaryAction = createServerAction(async () =>
  getTikTokEnvAccountSummary()
)

export const connectTikTokAdAccountAction = createServerAction(
  async (input: {
    advertiserId: string
    accessToken: string
    name?: string
    identityId?: string
    setAsDefault?: boolean
  }) => {
    const account = await connectTikTokAdAccount(input)
    clearTikTokCache()
    return account
  }
)

export const importTikTokEnvAccountAction = createServerAction(async () => {
  const account = await importTikTokEnvAccount()
  clearTikTokCache()
  return account
})

export const setDefaultTikTokAdAccountForTestsAction = createServerAction(
  async (accountId: string) => {
    const account = await setDefaultTikTokAdAccountForTests(accountId)
    clearTikTokCache()
    return account
  }
)

export const setDefaultTikTokAdAccountAction = createServerAction(
  async (accountId: string) => {
    const account = await setDefaultTikTokAdAccount(accountId)
    clearTikTokCache()
    return account
  }
)

export const disconnectTikTokAdAccountAction = createServerAction(
  async (accountId: string) => {
    await disconnectTikTokAdAccount(accountId)
    clearTikTokCache()
  }
)

export const refreshTikTokAdAccountAction = createServerAction(
  async (accountId: string) => refreshTikTokAdAccountMetadata(accountId)
)

export const refreshAllTikTokAdAccountsAction = createServerAction(async () =>
  refreshAllTikTokAdAccountStatuses()
)

export const getTikTokAdAccountsHealthAction = createServerAction(async () =>
  getTikTokAdAccountsHealth()
)
