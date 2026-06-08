import "server-only"

import axios from "axios"
import prisma from "@/lib/prisma"

const META_GRAPH_BASE = "https://graph.facebook.com/v22.0"

const PAGE_PERMISSIONS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_manage_metadata",
] as const

export type MetaOAuthDiagnostics = {
  appId: string | null
  appName: string | null
  appLink: string | null
  redirectUri: string
  configIdSource: "env" | "database" | null
  configIdConfigured: boolean
  configuredPermissions: string[]
  missingPagePermissions: string[]
  metaAppUrl: string | null
  metaBusinessLoginUrl: string | null
  metaAppReviewUrl: string | null
  issues: string[]
}

function getAppAccessToken(): string | null {
  const appId = process.env.META_APP_ID?.trim()
  const appSecret = process.env.META_APP_SECRET?.trim()
  if (!appId || !appSecret) return null
  return `${appId}|${appSecret}`
}

export async function resolveMetaOAuthConfigId(): Promise<{
  configId: string | null
  source: "env" | "database" | null
}> {
  const fromEnv = process.env.META_OAUTH_CONFIG_ID?.trim()
  if (fromEnv) return { configId: fromEnv, source: "env" }

  const settings = await prisma.metaCommentAgentSettings.findUnique({
    where: { id: "default" },
    select: { metaOAuthConfigId: true },
  })
  const fromDb = settings?.metaOAuthConfigId?.trim()
  if (fromDb) return { configId: fromDb, source: "database" }

  return { configId: null, source: null }
}

export async function saveMetaOAuthConfigId(configId: string): Promise<void> {
  const trimmed = configId.trim()
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("El config_id debe ser un número (Configuration ID de Meta).")
  }

  await prisma.metaCommentAgentSettings.upsert({
    where: { id: "default" },
    update: { metaOAuthConfigId: trimmed },
    create: { metaOAuthConfigId: trimmed },
  })
}

export async function getMetaOAuthDiagnostics(
  redirectUri: string
): Promise<MetaOAuthDiagnostics> {
  const appId = process.env.META_APP_ID?.trim() ?? null
  const appToken = getAppAccessToken()
  const { configId, source } = await resolveMetaOAuthConfigId()

  const issues: string[] = []
  let appName: string | null = null
  let appLink: string | null = null
  let configuredPermissions: string[] = []

  if (!appId || !appToken) {
    issues.push("Faltan META_APP_ID y META_APP_SECRET en el servidor.")
  } else {
    try {
      const [{ data: appData }, { data: permData }] = await Promise.all([
        axios.get<{ name?: string; link?: string }>(
          `${META_GRAPH_BASE}/${appId}`,
          {
            params: { fields: "name,link", access_token: appToken },
          }
        ),
        axios.get<{
          data?: Array<{ permission: string; status?: string }>
        }>(`${META_GRAPH_BASE}/${appId}/permissions`, {
          params: { access_token: appToken },
        }),
      ])

      appName = appData.name ?? null
      appLink = appData.link ?? null
      configuredPermissions = (permData.data ?? []).map((p) => p.permission)
    } catch {
      issues.push("No se pudo consultar la app en Meta. Verificá App ID y Secret.")
    }
  }

  const missingPagePermissions = PAGE_PERMISSIONS.filter(
    (p) => !configuredPermissions.includes(p)
  )

  if (!configId) {
    issues.push(
      "Falta config_id: creá una Configuration en Facebook Login for Business y pegala abajo."
    )
  }

  if (missingPagePermissions.length === PAGE_PERMISSIONS.length) {
    issues.push(
      "La app no tiene permisos de páginas aprobados en Meta (App Review)."
    )
  } else if (missingPagePermissions.length > 0) {
    issues.push(
      `Faltan permisos de páginas en Meta: ${missingPagePermissions.join(", ")}.`
    )
  }

  return {
    appId,
    appName,
    appLink,
    redirectUri,
    configIdSource: source,
    configIdConfigured: Boolean(configId),
    configuredPermissions,
    missingPagePermissions: [...missingPagePermissions],
    metaAppUrl: appId ? `https://developers.facebook.com/apps/${appId}/` : null,
    metaBusinessLoginUrl: appId
      ? `https://developers.facebook.com/apps/${appId}/business-login/settings/`
      : null,
    metaAppReviewUrl: appId
      ? `https://developers.facebook.com/apps/${appId}/app-review/permissions/`
      : null,
    issues,
  }
}
