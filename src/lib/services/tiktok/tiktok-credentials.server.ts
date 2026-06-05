import "server-only"

import { cache } from "react"
import prisma from "@/lib/prisma"
import { ServerActionError } from "@/lib/server-action"
import {
  readTikTokEnvCredentials,
  type TikTokCredentials,
} from "./tiktok-client"

export type { TikTokCredentials, TikTokCredentialSource } from "./tiktok-client"

export function assertTikTokAdAccountPrisma() {
  if (!prisma.tikTokAdAccount) {
    throw new ServerActionError(
      "Cliente Prisma desactualizado (falta TikTokAdAccount). Ejecutá: pnpm prisma generate && pnpm prisma migrate deploy"
    )
  }
}

export const resolveTikTokCredentials = cache(
  async (): Promise<TikTokCredentials> => {
    if (prisma.tikTokAdAccount) {
      const defaultAccount = await prisma.tikTokAdAccount.findFirst({
        where: { status: "active", isDefault: true },
        orderBy: { connectedAt: "desc" },
      })

      if (defaultAccount) {
        return {
          accessToken: defaultAccount.accessToken,
          advertiserId: defaultAccount.advertiserId,
          identityId: defaultAccount.identityId,
          source: "database",
          accountId: defaultAccount.id,
        }
      }
    }

    const fromEnv = readTikTokEnvCredentials()
    if (fromEnv) return fromEnv

    throw new Error(
      "No hay cuenta TikTok Ads activa. Conectá una en Cuentas TikTok Ads o configurá TIKTOK_ACCESS_TOKEN y TIKTOK_ADVERTISER_ID en .env"
    )
  }
)

export async function hasTikTokCredentialsConfigured(): Promise<boolean> {
  if (prisma.tikTokAdAccount) {
    const dbCount = await prisma.tikTokAdAccount.count({
      where: { status: "active" },
    })
    if (dbCount > 0) return true
  }
  return readTikTokEnvCredentials() != null
}
