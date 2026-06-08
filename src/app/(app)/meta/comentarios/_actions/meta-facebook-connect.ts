"use server"

import { createServerAction } from "@/lib/server-action"
import {
  disconnectPage,
  listConnectedPages,
  isMetaOAuthConfigured,
  getMetaOAuthRedirectUri,
  usesMetaBusinessLogin,
} from "@/lib/services/meta/meta-oauth.server"
import {
  getMetaOAuthDiagnostics,
  saveMetaOAuthConfigId,
} from "@/lib/services/meta/meta-oauth-diagnostics"

export const listConnectedFacebookPagesAction = createServerAction(async () => {
  const pages = await listConnectedPages()
  return pages.map((p) => ({
    id: p.id,
    pageId: p.pageId,
    pageName: p.pageName,
    pageCategory: p.pageCategory,
    connected: p.connected,
    updatedAt: p.updatedAt.toISOString(),
  }))
})

export const disconnectFacebookPageAction = createServerAction(
  async (pageId: string) => {
    await disconnectPage(pageId)
    return { ok: true }
  }
)

export const getMetaOAuthStatusAction = createServerAction(async () => {
  const redirectUri = getMetaOAuthRedirectUri()
  const [businessLoginConfigured, diagnostics] = await Promise.all([
    usesMetaBusinessLogin(),
    getMetaOAuthDiagnostics(redirectUri),
  ])

  return {
    configured: isMetaOAuthConfigured(),
    redirectUri,
    businessLoginConfigured,
    diagnostics,
  }
})

export const saveMetaOAuthConfigIdAction = createServerAction(
  async (configId: string) => {
    await saveMetaOAuthConfigId(configId)
    return { ok: true }
  }
)
