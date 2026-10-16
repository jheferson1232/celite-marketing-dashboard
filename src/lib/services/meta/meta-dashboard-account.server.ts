import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"
import { installMetaDashboardAccountAls } from "./meta-dashboard-account-store"

const storage = new AsyncLocalStorage<{ accountId?: string }>()

installMetaDashboardAccountAls(storage)

function normalizeAccountId(accountId: string | undefined): string | undefined {
  const id = accountId?.replace(/^act_/i, "").trim()
  return id || undefined
}

/** Ejecuta `fn` consultando la cuenta Meta indicada. Sin id, sigue la del entorno. */
export function withMetaDashboardAccount<T>(
  accountId: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const id = normalizeAccountId(accountId)
  if (!id) return fn()
  return storage.run({ accountId: id }, fn)
}
