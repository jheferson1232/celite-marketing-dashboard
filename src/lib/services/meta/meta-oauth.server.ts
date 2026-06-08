import "server-only"

import crypto from "crypto"
import axios from "axios"
import prisma from "@/lib/prisma"

const META_OAUTH_STATE_COOKIE = "meta_oauth_state"
const META_GRAPH_BASE = "https://graph.facebook.com/v22.0"

export { META_OAUTH_STATE_COOKIE }

export type MetaOAuthPageResult = {
  pageId: string
  pageName: string
  pageCategory: string | null
  accessToken: string
  tokenExpires: Date | null
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(
    process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim()
  )
}

export function getMetaOAuthRedirectUri(): string {
  const fromEnv = process.env.META_OAUTH_REDIRECT_URI?.trim()
  if (fromEnv) return fromEnv

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (appUrl) {
    return `${appUrl.replace(/\/$/, "")}/api/meta/oauth/callback`
  }

  const vercelUrl = process.env.VERCEL_URL?.trim()
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}/api/meta/oauth/callback`
  }

  return "http://localhost:3000/api/meta/oauth/callback"
}

export function createMetaOAuthState(): string {
  return crypto.randomBytes(24).toString("hex")
}

/** Config de Facebook Login for Business (Meta App Dashboard → Configurations). */
export function getMetaOAuthConfigId(): string | null {
  return process.env.META_OAUTH_CONFIG_ID?.trim() || null
}

export function usesMetaBusinessLogin(): boolean {
  return Boolean(getMetaOAuthConfigId())
}

export function buildMetaOAuthLoginUrl(state: string): string {
  const appId = process.env.META_APP_ID?.trim()
  if (!appId) throw new Error("Falta META_APP_ID en variables de entorno")

  const url = new URL("https://www.facebook.com/v22.0/dialog/oauth")
  url.searchParams.set("client_id", appId)
  url.searchParams.set("redirect_uri", getMetaOAuthRedirectUri())
  url.searchParams.set("state", state)
  url.searchParams.set("response_type", "code")

  const configId = getMetaOAuthConfigId()
  if (configId) {
    // Apps Business nuevas: usar config_id en vez de scope
    url.searchParams.set("config_id", configId)
    url.searchParams.set("override_default_response_type", "true")
  } else {
    url.searchParams.set(
      "scope",
      "pages_show_list,pages_read_engagement,pages_manage_engagement,pages_manage_metadata"
    )
  }

  return url.toString()
}

async function exchangeCodeForShortToken(code: string): Promise<string> {
  const appId = process.env.META_APP_ID?.trim()
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appId || !appSecret) {
    throw new Error("Faltan META_APP_ID y META_APP_SECRET")
  }

  const { data } = await axios.get<{
    access_token?: string
    error?: { message?: string }
  }>(`${META_GRAPH_BASE}/oauth/access_token`, {
    params: {
      client_id: appId,
      redirect_uri: getMetaOAuthRedirectUri(),
      client_secret: appSecret,
      code,
    },
  })

  if (data.error?.message || !data.access_token) {
    throw new Error(data.error?.message ?? "Meta no devolvió access_token")
  }

  return data.access_token
}

async function getLongLivedUserToken(shortToken: string): Promise<string> {
  const appId = process.env.META_APP_ID?.trim()
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appId || !appSecret) {
    throw new Error("Faltan META_APP_ID y META_APP_SECRET")
  }

  const { data } = await axios.get<{
    access_token?: string
    error?: { message?: string }
  }>(`${META_GRAPH_BASE}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    },
  })

  if (data.error?.message || !data.access_token) {
    throw new Error(data.error?.message ?? "No se pudo obtener long-lived token")
  }

  return data.access_token
}

async function getPagesFromUserToken(
  userToken: string
): Promise<MetaOAuthPageResult[]> {
  const { data } = await axios.get<{
    data?: Array<{
      id: string
      name: string
      category?: string
      access_token?: string
    }>
    error?: { message?: string }
  }>(`${META_GRAPH_BASE}/me/accounts`, {
    params: { fields: "id,name,category,access_token", limit: 100 },
    headers: { Authorization: `Bearer ${userToken}` },
  })

  if (data.error?.message) {
    throw new Error(data.error.message)
  }

  return (data.data ?? [])
    .filter((p) => p.access_token)
    .map((p) => ({
      pageId: p.id,
      pageName: p.name,
      pageCategory: p.category ?? null,
      accessToken: p.access_token!,
      tokenExpires: null,
    }))
}

export async function exchangeCodeAndSavePages(
  code: string
): Promise<MetaOAuthPageResult[]> {
  const shortToken = await exchangeCodeForShortToken(code)
  const longToken = await getLongLivedUserToken(shortToken)
  const pages = await getPagesFromUserToken(longToken)

  if (pages.length === 0) {
    throw new Error(
      "No se encontraron páginas de Facebook. Asegurate de tener páginas administradas."
    )
  }

  await Promise.all(
    pages.map((page) =>
      prisma.metaFacebookConnection.upsert({
        where: { pageId: page.pageId },
        update: {
          pageName: page.pageName,
          pageCategory: page.pageCategory,
          accessToken: page.accessToken,
          tokenExpires: page.tokenExpires,
          connected: true,
        },
        create: {
          pageId: page.pageId,
          pageName: page.pageName,
          pageCategory: page.pageCategory,
          accessToken: page.accessToken,
          tokenExpires: page.tokenExpires,
          connected: true,
        },
      })
    )
  )

  return pages
}

export async function listConnectedPages() {
  return prisma.metaFacebookConnection.findMany({
    where: { connected: true },
    orderBy: { pageName: "asc" },
  })
}

export async function disconnectPage(pageId: string) {
  return prisma.metaFacebookConnection.update({
    where: { pageId },
    data: { connected: false },
  })
}
