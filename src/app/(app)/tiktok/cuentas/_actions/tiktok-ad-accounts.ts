"use server"

import { createServerAction } from "@/lib/server-action"
import {
  connectTikTokAdAccount,
  disconnectTikTokAdAccount,
  getTikTokEnvAccountSummary,
  importTikTokEnvAccount,
  listTikTokAdAccounts,
  refreshTikTokAdAccountMetadata,
  setDefaultTikTokAdAccount,
  setDefaultTikTokAdAccountForTests,
} from "@/lib/services/tiktok/ad-accounts"
import { clearTikTokCache } from "@/lib/services/tiktok/tiktok-cache"
import {
  getTikTokOAuthRedirectUri,
  isTikTokOAuthConfigured,
} from "@/lib/services/tiktok/tiktok-oauth.server"

export const getTikTokOAuthStatusAction = createServerAction(async () => ({
  configured: isTikTokOAuthConfigured(),
  redirectUri: getTikTokOAuthRedirectUri(),
}))

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
