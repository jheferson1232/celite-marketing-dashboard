import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import {
  assertTikTokAdAccountPrisma,
} from "./tiktok-credentials.server"
import { createTikTokClient } from "./tiktok-client"
import { exchangeTikTokOAuthCode } from "./tiktok-oauth.server"
import {
  parseTikTokAdvertiserStatus,
  type TikTokAdvertiserStatusKind,
} from "./tiktok-advertiser-status.shared"

export type TikTokAdAccountSummary = {
  id: string
  advertiserId: string
  name: string
  currency: string | null
  timezone: string | null
  country: string | null
  /** Conectada en el dashboard vs desconectada */
  status: "active" | "disconnected"
  /** Estado en TikTok Ads (API /advertiser/info/) */
  advertiserStatus: string | null
  advertiserStatusKind: TikTokAdvertiserStatusKind
  advertiserStatusLabel: string
  isDefault: boolean
  isDefaultForTests: boolean
  connectedAt: string
  hasIdentity: boolean
  source: "database" | "env"
}

export type TikTokEnvAccountSummary = {
  advertiserId: string
  name: string
  source: "env"
  isDefault: boolean
  alreadyImported: boolean
}

type TikTokAdvertiserInfo = {
  advertiser_id: string
  name?: string
  currency?: string
  timezone?: string
  country?: string
  status?: string
}

function mapAccountRow(row: {
  id: string
  advertiserId: string
  name: string
  currency: string | null
  timezone: string | null
  country: string | null
  advertiserStatus: string | null
  status: string
  isDefault: boolean
  isDefaultForTests: boolean
  connectedAt: Date
  identityId: string | null
}): TikTokAdAccountSummary {
  const tikTokStatus = parseTikTokAdvertiserStatus(row.advertiserStatus)
  return {
    id: row.id,
    advertiserId: row.advertiserId,
    name: row.name,
    currency: row.currency,
    timezone: row.timezone,
    country: row.country,
    status: row.status === "disconnected" ? "disconnected" : "active",
    advertiserStatus: tikTokStatus.raw,
    advertiserStatusKind: tikTokStatus.kind,
    advertiserStatusLabel: tikTokStatus.label,
    isDefault: row.isDefault,
    isDefaultForTests: row.isDefaultForTests,
    connectedAt: row.connectedAt.toISOString(),
    hasIdentity: Boolean(row.identityId?.trim()),
    source: "database",
  }
}

const ADVERTISER_INFO_FIELDS = [
  "advertiser_id",
  "name",
  "currency",
  "timezone",
  "country",
  "status",
] as const

async function fetchAdvertiserInfo(
  accessToken: string,
  advertiserId: string
): Promise<TikTokAdvertiserInfo> {
  const client = createTikTokClient(accessToken)
  const { data } = await client.get<{
    data: { list?: TikTokAdvertiserInfo[] }
  }>("/advertiser/info/", {
    params: {
      advertiser_ids: JSON.stringify([advertiserId]),
      fields: JSON.stringify([...ADVERTISER_INFO_FIELDS]),
    },
  })

  const info = data.data.list?.[0]
  if (!info) {
    throw new ServerActionError(
      "No se pudo obtener información del advertiser. Verificá el ID y que el token tenga acceso a esta cuenta."
    )
  }
  return info
}

function readEnvCredentials() {
  const token = process.env.TIKTOK_ACCESS_TOKEN?.trim()
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID?.trim()
  if (!token || !advertiserId) return null
  return { accessToken: token, advertiserId }
}

export async function listTikTokAdAccounts(): Promise<TikTokAdAccountSummary[]> {
  assertTikTokAdAccountPrisma()
  const rows = await prisma.tikTokAdAccount.findMany({
    where: { status: "active" },
    orderBy: [
      { isDefaultForTests: "desc" },
      { isDefault: "desc" },
      { connectedAt: "desc" },
    ],
  })
  return rows.map(mapAccountRow)
}

export async function getTikTokEnvAccountSummary(): Promise<TikTokEnvAccountSummary | null> {
  const env = readEnvCredentials()
  if (!env) return null

  assertTikTokAdAccountPrisma()
  const existing = await prisma.tikTokAdAccount.findUnique({
    where: { advertiserId: env.advertiserId },
  })

  const hasDbDefault = await prisma.tikTokAdAccount.findFirst({
    where: { status: "active", isDefault: true },
    select: { id: true },
  })

  return {
    advertiserId: env.advertiserId,
    name: "Cuenta desde .env",
    source: "env",
    isDefault: !hasDbDefault,
    alreadyImported: Boolean(existing && existing.status === "active"),
  }
}

export async function connectTikTokAdAccount(input: {
  advertiserId: string
  accessToken: string
  refreshToken?: string | null
  name?: string
  identityId?: string
  setAsDefault?: boolean
}): Promise<TikTokAdAccountSummary> {
  assertTikTokAdAccountPrisma()

  const advertiserId = input.advertiserId.trim()
  const accessToken = input.accessToken.trim()

  if (!/^\d+$/.test(advertiserId)) {
    throw new ServerActionError("El Advertiser ID debe ser numérico.")
  }
  if (!accessToken) {
    throw new ServerActionError("El access token es obligatorio.")
  }

  let info: TikTokAdvertiserInfo
  try {
    info = await fetchAdvertiserInfo(accessToken, advertiserId)
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    const message =
      error instanceof Error ? error.message : "Error al validar la cuenta"
    throw new ServerActionError(message)
  }

  const name =
    input.name?.trim() ||
    info.name?.trim() ||
    `Cuenta ${advertiserId.slice(-4)}`

  const identityId = input.identityId?.trim() || null
  const refreshToken = input.refreshToken?.trim() || null
  const setAsDefault = input.setAsDefault ?? true

  const account = await prisma.$transaction(async (tx) => {
    if (setAsDefault) {
      await tx.tikTokAdAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const activeCount = await tx.tikTokAdAccount.count({
      where: { status: "active" },
    })

    return tx.tikTokAdAccount.upsert({
      where: { advertiserId },
      create: {
        advertiserId,
        name,
        accessToken,
        refreshToken,
        identityId,
        currency: info.currency ?? null,
        timezone: info.timezone ?? null,
        country: info.country ?? null,
        advertiserStatus: info.status?.trim() || null,
        status: "active",
        isDefault: setAsDefault || activeCount === 0,
      },
      update: {
        name,
        accessToken,
        refreshToken,
        identityId,
        currency: info.currency ?? null,
        timezone: info.timezone ?? null,
        country: info.country ?? null,
        advertiserStatus: info.status?.trim() || null,
        status: "active",
        ...(setAsDefault ? { isDefault: true } : {}),
      },
    })
  })

  return mapAccountRow(account)
}

export async function importTikTokEnvAccount(): Promise<TikTokAdAccountSummary> {
  const env = readEnvCredentials()
  if (!env) {
    throw new ServerActionError(
      "No hay TIKTOK_ACCESS_TOKEN ni TIKTOK_ADVERTISER_ID en el entorno."
    )
  }

  return connectTikTokAdAccount({
    advertiserId: env.advertiserId,
    accessToken: env.accessToken,
    identityId: process.env.TIKTOK_IDENTITY_ID?.trim(),
    setAsDefault: true,
  })
}

export async function connectTikTokAdAccountsFromAuthCode(
  authCode: string
): Promise<TikTokAdAccountSummary[]> {
  const token = await exchangeTikTokOAuthCode(authCode)
  return connectTikTokAdAccountsFromOAuth({
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    advertiserIds: token.advertiserIds,
  })
}

export async function connectTikTokAdAccountsFromOAuth(input: {
  accessToken: string
  refreshToken: string | null
  advertiserIds: string[]
}): Promise<TikTokAdAccountSummary[]> {
  assertTikTokAdAccountPrisma()

  const advertiserIds = [...new Set(input.advertiserIds)]
  if (advertiserIds.length === 0) {
    throw new ServerActionError(
      "TikTok no devolvió ningún advertiser autorizado para esta app."
    )
  }

  const existingTestDefault = await prisma.tikTokAdAccount.findFirst({
    where: { status: "active", isDefaultForTests: true },
    select: { id: true },
  })

  const connected: TikTokAdAccountSummary[] = []

  for (const advertiserId of advertiserIds) {
    const account = await connectTikTokAdAccount({
      advertiserId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      setAsDefault: false,
    })
    connected.push(account)
  }

  if (!existingTestDefault && connected[0]) {
    return [await setDefaultTikTokAdAccountForTests(connected[0].id), ...connected.slice(1)]
  }

  return connected
}

export async function setDefaultTikTokAdAccountForTests(
  accountId: string
): Promise<TikTokAdAccountSummary> {
  assertTikTokAdAccountPrisma()

  const account = await prisma.tikTokAdAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || account.status !== "active") {
    throw new ServerActionError("Cuenta no encontrada o desconectada.")
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.tikTokAdAccount.updateMany({
      where: { isDefaultForTests: true },
      data: { isDefaultForTests: false },
    })
    await tx.tikTokAdAccount.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
    return tx.tikTokAdAccount.update({
      where: { id: accountId },
      data: { isDefaultForTests: true, isDefault: true },
    })
  })

  return mapAccountRow(updated)
}

export async function setDefaultTikTokAdAccount(
  accountId: string
): Promise<TikTokAdAccountSummary> {
  assertTikTokAdAccountPrisma()

  const account = await prisma.tikTokAdAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || account.status !== "active") {
    throw new ServerActionError("Cuenta no encontrada o desconectada.")
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.tikTokAdAccount.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
    return tx.tikTokAdAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    })
  })

  return mapAccountRow(updated)
}

export async function disconnectTikTokAdAccount(
  accountId: string
): Promise<void> {
  assertTikTokAdAccountPrisma()

  const account = await prisma.tikTokAdAccount.findUnique({
    where: { id: accountId },
  })

  if (!account) {
    throw new ServerActionError("Cuenta no encontrada.")
  }

  await prisma.$transaction(async (tx) => {
    await tx.tikTokAdAccount.update({
      where: { id: accountId },
      data: {
        status: "disconnected",
        isDefault: false,
        isDefaultForTests: false,
        accessToken: "",
      },
    })

    if (account.isDefault || account.isDefaultForTests) {
      const next = await tx.tikTokAdAccount.findFirst({
        where: { status: "active", id: { not: accountId } },
        orderBy: { connectedAt: "desc" },
      })
      if (next) {
        await tx.tikTokAdAccount.update({
          where: { id: next.id },
          data: { isDefault: true },
        })
      }
    }
  })
}

export async function getDefaultTikTokAdAccountForTests(): Promise<TikTokAdAccountSummary | null> {
  assertTikTokAdAccountPrisma()
  const row = await prisma.tikTokAdAccount.findFirst({
    where: { status: "active", isDefaultForTests: true },
    orderBy: { connectedAt: "desc" },
  })
  return row ? mapAccountRow(row) : null
}

export async function refreshTikTokAdAccountMetadata(
  accountId: string
): Promise<TikTokAdAccountSummary> {
  assertTikTokAdAccountPrisma()

  const account = await prisma.tikTokAdAccount.findUnique({
    where: { id: accountId },
  })

  if (!account || account.status !== "active" || !account.accessToken) {
    throw new ServerActionError("Cuenta no encontrada o sin token.")
  }

  const info = await fetchAdvertiserInfo(
    account.accessToken,
    account.advertiserId
  )

  const updated = await prisma.tikTokAdAccount.update({
    where: { id: accountId },
    data: {
      name: info.name?.trim() || account.name,
      currency: info.currency ?? account.currency,
      timezone: info.timezone ?? account.timezone,
      country: info.country ?? account.country,
      advertiserStatus: info.status?.trim() || account.advertiserStatus,
    },
  })

  return mapAccountRow(updated)
}

export async function refreshAllTikTokAdAccountStatuses(): Promise<
  TikTokAdAccountSummary[]
> {
  assertTikTokAdAccountPrisma()

  const rows = await prisma.tikTokAdAccount.findMany({
    where: { status: "active" },
    orderBy: { connectedAt: "desc" },
  })

  await Promise.all(
    rows.map(async (row) => {
      if (!row.accessToken?.trim()) return
      try {
        const info = await fetchAdvertiserInfo(
          row.accessToken,
          row.advertiserId
        )
        await prisma.tikTokAdAccount.update({
          where: { id: row.id },
          data: {
            name: info.name?.trim() || row.name,
            currency: info.currency ?? row.currency,
            timezone: info.timezone ?? row.timezone,
            country: info.country ?? row.country,
            advertiserStatus: info.status?.trim() || null,
          },
        })
      } catch (error) {
        console.warn(
          `[tiktok] No se pudo refrescar estado de ${row.advertiserId}:`,
          error instanceof Error ? error.message : error
        )
      }
    })
  )

  return listTikTokAdAccounts()
}
