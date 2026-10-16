import "server-only"

import prisma from "@/lib/prisma"
import { assertMetaEnvConfigured, isMetaEnvConfigured } from "./meta-env"
import { metaGraphErrorMessage } from "./meta-errors"
import { buildMetaGraphUrl } from "./meta-graph-fetch"
import { withMetaCache } from "./meta-cache"

export type MetaAdAccountSummary = {
  accountId: string
  name: string
  currency: string | null
  accountStatus: number | null
  statusLabel: string | null
  isDefault: boolean
}

type RemoteAdAccount = {
  accountId: string
  name: string
  currency: string | null
  timezone: string | null
  accountStatus: number | null
}

type GraphAdAccount = {
  id?: string
  account_id?: string
  name?: string
  currency?: string
  account_status?: number
  timezone_name?: string
}

type GraphAdAccountsPage = {
  data?: GraphAdAccount[]
  paging?: { next?: string }
  error?: { message?: string }
}

const LIST_TTL_MS = 60_000
const MAX_PAGES = 20

function normalizeAccountId(raw: string | undefined): string {
  return raw?.replace(/^act_/i, "").trim() ?? ""
}

function statusLabel(status: number | null): string | null {
  switch (status) {
    case 1:
      return null
    case 2:
      return "Bloqueada"
    case 3:
    case 8:
      return "Pago pendiente"
    case 7:
      return "En revisión"
    case 9:
      return "Periodo de gracia"
    case 100:
      return "Por cerrar"
    case 101:
      return "Cerrada"
    default:
      return status == null ? null : "Revisar"
  }
}

function mapRow(row: {
  accountId: string
  name: string
  currency: string | null
  accountStatus: number | null
  isDefault: boolean
}): MetaAdAccountSummary {
  return {
    accountId: row.accountId,
    name: row.name,
    currency: row.currency,
    accountStatus: row.accountStatus,
    statusLabel: statusLabel(row.accountStatus),
    isDefault: row.isDefault,
  }
}

function toRemote(row: GraphAdAccount): RemoteAdAccount | null {
  const accountId = normalizeAccountId(row.account_id ?? row.id)
  if (!accountId) return null
  return {
    accountId,
    name: row.name?.trim() || `Cuenta ${accountId.slice(-4)}`,
    currency: row.currency?.trim() || null,
    timezone: row.timezone_name?.trim() || null,
    accountStatus:
      typeof row.account_status === "number" ? row.account_status : null,
  }
}

async function fetchGraphPage(url: string): Promise<GraphAdAccountsPage> {
  const response = await fetch(url, { cache: "no-store" })
  const body = (await response.json().catch(() => null)) as GraphAdAccountsPage | null
  if (!response.ok || !body || body.error) {
    throw new Error(metaGraphErrorMessage(response.status, body))
  }
  return body
}

async function fetchRemoteAdAccounts(): Promise<RemoteAdAccount[]> {
  const accounts: RemoteAdAccount[] = []
  const seen = new Set<string>()
  let url: string | null = buildMetaGraphUrl("me/adaccounts", {
    fields: "id,account_id,name,currency,account_status,timezone_name",
    limit: "100",
  })

  for (let page = 0; page < MAX_PAGES && url; page += 1) {
    const body = await fetchGraphPage(url)
    for (const row of body.data ?? []) {
      const account = toRemote(row)
      if (!account || seen.has(account.accountId)) continue
      seen.add(account.accountId)
      accounts.push(account)
    }
    url = body.paging?.next ?? null
  }

  return accounts
}

async function fetchEnvAccount(accountId: string): Promise<RemoteAdAccount> {
  const body = await fetchGraphPage(
    buildMetaGraphUrl(`act_${accountId}`, {
      fields: "id,account_id,name,currency,account_status,timezone_name",
    })
  )
  const account = toRemote(body as GraphAdAccount)
  return (
    account ?? {
      accountId,
      name: `Cuenta ${accountId.slice(-4)}`,
      currency: null,
      timezone: null,
      accountStatus: null,
    }
  )
}

async function syncAccounts(remote: RemoteAdAccount[], envAccountId: string) {
  const ids = remote.map((account) => account.accountId)
  await prisma.$transaction(async (tx) => {
    for (const account of remote) {
      await tx.metaAdAccount.upsert({
        where: { accountId: account.accountId },
        create: {
          accountId: account.accountId,
          name: account.name,
          currency: account.currency,
          timezone: account.timezone,
          accountStatus: account.accountStatus,
          status: "active",
          isDefault: account.accountId === envAccountId,
        },
        update: {
          name: account.name,
          currency: account.currency,
          timezone: account.timezone,
          accountStatus: account.accountStatus,
          status: "active",
          isDefault: account.accountId === envAccountId,
          syncedAt: new Date(),
        },
      })
    }

    if (ids.length > 0) {
      await tx.metaAdAccount.updateMany({
        where: { accountId: { notIn: ids }, status: "active" },
        data: { status: "disconnected", isDefault: false },
      })
    }
  })
}

async function readStoredAccounts(): Promise<MetaAdAccountSummary[]> {
  const rows = await prisma.metaAdAccount.findMany({
    where: { status: "active" },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  })
  return rows.map(mapRow)
}

function summariesFromRemote(
  remote: RemoteAdAccount[],
  envAccountId: string
): MetaAdAccountSummary[] {
  return remote
    .map((account) =>
      mapRow({
        accountId: account.accountId,
        name: account.name,
        currency: account.currency,
        accountStatus: account.accountStatus,
        isDefault: account.accountId === envAccountId,
      })
    )
    .toSorted((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      return a.name.localeCompare(b.name, "es")
    })
}

async function loadMetaAdAccounts(): Promise<MetaAdAccountSummary[]> {
  assertMetaEnvConfigured()
  const envAccountId = normalizeAccountId(process.env.META_AD_ACCOUNT_ID)
  let remote: RemoteAdAccount[] = []

  try {
    remote = await fetchRemoteAdAccounts()
    if (!remote.some((account) => account.accountId === envAccountId)) {
      remote.unshift(await fetchEnvAccount(envAccountId))
    }
    if (remote.length > 0) {
      await syncAccounts(remote, envAccountId)
    }
  } catch (error) {
    console.error("[meta-ad-accounts]", error)
  }

  try {
    const stored = await readStoredAccounts()
    if (stored.length > 0) return stored
  } catch (error) {
    console.error("[meta-ad-accounts]", error)
  }

  if (remote.length > 0) return summariesFromRemote(remote, envAccountId)

  return [
    {
      accountId: envAccountId,
      name: "Cuenta configurada",
      currency: null,
      accountStatus: null,
      statusLabel: null,
      isDefault: true,
    },
  ]
}

export async function listMetaAdAccounts(): Promise<MetaAdAccountSummary[]> {
  if (!isMetaEnvConfigured()) return []
  const envAccountId = normalizeAccountId(process.env.META_AD_ACCOUNT_ID)
  return withMetaCache(`meta-ad-accounts:v2:${envAccountId}`, LIST_TTL_MS, () =>
    loadMetaAdAccounts()
  )
}
