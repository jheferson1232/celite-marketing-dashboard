import "server-only"

import type { AxiosInstance } from "axios"
import { createTikTokClient } from "./tiktok-client"
import {
  resolveTikTokCredentials,
  type TikTokCredentials,
} from "./tiktok-credentials.server"

export async function getTikTokRequestContext(): Promise<{
  client: AxiosInstance
  advertiserId: string
  accessToken: string
  identityId: string | null
  credentials: TikTokCredentials
}> {
  const credentials = await resolveTikTokCredentials()
  return {
    credentials,
    accessToken: credentials.accessToken,
    advertiserId: credentials.advertiserId,
    identityId: credentials.identityId,
    client: createTikTokClient(credentials.accessToken),
  }
}
