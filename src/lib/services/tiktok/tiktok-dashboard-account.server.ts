import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"

const storage = new AsyncLocalStorage<{ accountId?: string }>()

export function getTikTokDashboardAccountId(): string | undefined {
  return storage.getStore()?.accountId?.trim() || undefined
}

export function withTikTokDashboardAccount<T>(
  accountId: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const id = accountId?.trim()
  if (!id) return fn()
  return storage.run({ accountId: id }, fn)
}
