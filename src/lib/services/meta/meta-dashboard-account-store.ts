type MetaDashboardAccountAls = {
  getStore(): { accountId?: string } | undefined
}

const globalStore = globalThis as typeof globalThis & {
  __metaDashboardAccountAls?: MetaDashboardAccountAls
}

/** Id de la cuenta Meta del request, si una server action del dashboard lo fijó. */
export function getMetaDashboardAccountId(): string | undefined {
  return globalStore.__metaDashboardAccountAls?.getStore()?.accountId?.trim() || undefined
}

export function installMetaDashboardAccountAls(storage: MetaDashboardAccountAls) {
  globalStore.__metaDashboardAccountAls = storage
}
