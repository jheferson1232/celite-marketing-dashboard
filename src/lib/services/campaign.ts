import prisma from "@/lib/prisma"
import {
  CAMPAIGN_STATUS_VALUES,
  canDeleteCampaign,
  isCampaignStatus,
  type CampaignStatus,
} from "@/lib/campaigns/status"
import {
  isTikTokStrategyId,
  normalizeABODynamicFields,
  normalizeCBODynamicFields,
  validateABODynamicFields,
  validateCBODynamicFields,
  type ABODynamicCampaignContext,
  type ABODynamicCreative,
  type ABODynamicFields,
  type ABOStrategyConfig,
  type CBODynamicCampaignContext,
  type CBODynamicFields,
  type CBOStrategyConfig,
  type CampaignLandingPageRef,
  type CampaignStrategyConfig,
  type TikTokStrategyId,
} from "@/lib/config/tiktok-strategies"
import {
  buildEmptyABOStrategyConfig,
  buildEmptyCBOStrategyConfig,
  getABOCampaignContext,
  getCBODynamicCampaignContext,
  parseCampaignStrategyConfig,
  rebuildABOStrategyConfig,
  rebuildCBOStrategyConfig,
} from "@/lib/services/campaign-strategy-builder"

export type { CampaignStatus } from "@/lib/campaigns/status"
export { CAMPAIGN_STATUS_VALUES } from "@/lib/campaigns/status"

export type CampaignRecord = {
  id: string
  name: string
  status: CampaignStatus
  strategy: TikTokStrategyId
  config: CampaignStrategyConfig
  createdAt: Date
  updatedAt: Date
}

function normalizeABOConfig(config: ABOStrategyConfig): ABOStrategyConfig {
  const context = getABOCampaignContext(config)
  return {
    ...config,
    landingPages: context.landingPages,
    creatives: context.creatives,
    dynamic: normalizeABODynamicFields(config.dynamic, context),
  }
}

function normalizeCBOConfig(config: CBOStrategyConfig): CBOStrategyConfig {
  const context = getCBODynamicCampaignContext(config)
  return {
    ...config,
    landingPages: context.landingPages,
    creatives: context.creatives,
    dynamic: normalizeCBODynamicFields(config.dynamic, context),
  }
}

function mapCampaignRecord(row: {
  id: string
  name: string
  status: string
  strategy: string
  config: unknown
  createdAt: Date
  updatedAt: Date
}): CampaignRecord {
  const parsedConfig = parseCampaignStrategyConfig(row.config)
  if (!parsedConfig) {
    throw new Error(`Config inválida para campaña ${row.id}`)
  }

  if (!isTikTokStrategyId(row.strategy)) {
    throw new Error(`Estrategia inválida para campaña ${row.id}`)
  }

  if (!isCampaignStatus(row.status)) {
    throw new Error(`Estado inválido para campaña ${row.id}`)
  }

  const config =
    parsedConfig.strategy === "ABO"
      ? normalizeABOConfig(parsedConfig)
      : parsedConfig.strategy === "CBO"
        ? normalizeCBOConfig(parsedConfig)
        : parsedConfig

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    strategy: row.strategy as TikTokStrategyId,
    config,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listCampaigns(): Promise<CampaignRecord[]> {
  const rows = await prisma.campaign.findMany({
    orderBy: [{ updatedAt: "desc" }],
  })

  return rows.map(mapCampaignRecord)
}

export async function getCampaignById(id: string): Promise<CampaignRecord | null> {
  const row = await prisma.campaign.findUnique({
    where: { id },
  })

  if (!row) return null
  return mapCampaignRecord(row)
}

export async function createCampaign(input: {
  name: string
  status?: CampaignStatus
  strategy: TikTokStrategyId
  pixelId?: string
  authCode?: string
  abo?: UpdateCampaignABOInput
  cbo?: UpdateCampaignCBOInput
}): Promise<CampaignRecord> {
  if (!isTikTokStrategyId(input.strategy)) {
    throw new Error("Estrategia no válida")
  }

  const trimmedName = input.name.trim()
  if (!trimmedName) {
    throw new Error("El nombre de la campaña es obligatorio")
  }

  if (input.strategy !== "ABO" && input.strategy !== "CBO") {
    throw new Error("Estrategia no soportada todavía")
  }

  const status = input.status ?? "draft"
  if (!isCampaignStatus(status)) {
    throw new Error("Estado no válido")
  }

  let config: CampaignStrategyConfig

  if (input.strategy === "ABO") {
    if (input.abo) {
      const context: ABODynamicCampaignContext = {
        budget: 0,
        landingPages: input.abo.landingPages,
        creatives: input.abo.creatives,
      }

      const normalizedDynamic = normalizeABODynamicFields(input.abo.dynamic, context)
      const validation = validateABODynamicFields(normalizedDynamic, context)
      if (!validation.valid) {
        const firstError = Object.values(validation.errors)[0]
        throw new Error(firstError ?? "Configuración ABO inválida")
      }

      config = rebuildABOStrategyConfig(trimmedName, normalizedDynamic, context, {
        pixelId: input.pixelId,
        authCode: input.authCode,
      })
    } else {
      config = buildEmptyABOStrategyConfig(trimmedName)
      if (input.pixelId?.trim()) {
        config.campaign.pixel_id = input.pixelId.trim()
      }
      if (input.authCode?.trim()) {
        config.campaign.auth_code = input.authCode.trim()
      }
    }
  } else {
    if (input.cbo) {
      const context: CBODynamicCampaignContext = {
        budget: 0,
        landingPages: input.cbo.landingPages,
        creatives: input.cbo.creatives,
      }

      const normalizedDynamic = normalizeCBODynamicFields(input.cbo.dynamic, context)
      const validation = validateCBODynamicFields(normalizedDynamic, context)
      if (!validation.valid) {
        const firstError = Object.values(validation.errors)[0]
        throw new Error(firstError ?? "Configuración CBO inválida")
      }

      config = rebuildCBOStrategyConfig(trimmedName, normalizedDynamic, context, {
        pixelId: input.pixelId,
        authCode: input.authCode,
      })
    } else {
      config = buildEmptyCBOStrategyConfig(trimmedName)
      if (input.pixelId?.trim()) {
        config.campaign.pixel_id = input.pixelId.trim()
      }
      if (input.authCode?.trim()) {
        config.campaign.auth_code = input.authCode.trim()
      }
    }
  }

  const row = await prisma.campaign.create({
    data: {
      name: trimmedName,
      status,
      strategy: input.strategy,
      config,
    },
  })

  return mapCampaignRecord(row)
}

export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus
): Promise<CampaignRecord> {
  if (!isCampaignStatus(status)) {
    throw new Error("Estado no válido")
  }

  const row = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status },
  })

  return mapCampaignRecord(row)
}

export async function updateCampaignStrategy(
  campaignId: string,
  strategy: TikTokStrategyId
): Promise<CampaignRecord> {
  if (!isTikTokStrategyId(strategy)) {
    throw new Error("Estrategia no válida")
  }

  const existing = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, strategy: true },
  })

  if (!existing) {
    throw new Error("Campaña no encontrada")
  }

  const config =
    strategy === "ABO"
      ? buildEmptyABOStrategyConfig(existing.name)
      : buildEmptyCBOStrategyConfig(existing.name)

  const row = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      strategy,
      config,
    },
  })

  return mapCampaignRecord(row)
}

export async function updateCampaignGeneral(
  campaignId: string,
  input: {
    name: string
    status: CampaignStatus
  }
): Promise<CampaignRecord> {
  const trimmedName = input.name.trim()
  if (!trimmedName) {
    throw new Error("El nombre de la campaña es obligatorio")
  }

  if (!isCampaignStatus(input.status)) {
    throw new Error("Estado no válido")
  }

  const row = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      name: trimmedName,
      status: input.status,
    },
  })

  return mapCampaignRecord(row)
}

export type UpdateCampaignABOInput = {
  dynamic: ABODynamicFields
  landingPages: CampaignLandingPageRef[]
  creatives: ABODynamicCreative[]
}

export async function updateCampaignABOConfig(
  campaignId: string,
  input: UpdateCampaignABOInput
): Promise<CampaignRecord> {
  const existing = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, strategy: true, config: true },
  })

  if (!existing) {
    throw new Error("Campaña no encontrada")
  }

  if (existing.strategy !== "ABO") {
    throw new Error("La campaña no usa estrategia ABO")
  }

  const context: ABODynamicCampaignContext = {
    budget: 0,
    landingPages: input.landingPages,
    creatives: input.creatives,
  }

  const normalizedDynamic = normalizeABODynamicFields(input.dynamic, context)
  const validation = validateABODynamicFields(normalizedDynamic, context)
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0]
    throw new Error(firstError ?? "Configuración ABO inválida")
  }

  const existingConfig =
    existing.strategy === "ABO"
      ? (parseCampaignStrategyConfig(existing.config) as ABOStrategyConfig | null)
      : null

  const config = rebuildABOStrategyConfig(
    existing.name,
    normalizedDynamic,
    context,
    {
      pixelId: existingConfig?.campaign.pixel_id,
      authCode: existingConfig?.campaign.auth_code,
    }
  )

  const row = await prisma.campaign.update({
    where: { id: campaignId },
    data: { config },
  })

  return mapCampaignRecord(row)
}

export type UpdateCampaignCBOInput = {
  dynamic: CBODynamicFields
  landingPages: CampaignLandingPageRef[]
  creatives: ABODynamicCreative[]
}

export async function updateCampaignCBOConfig(
  campaignId: string,
  input: UpdateCampaignCBOInput
): Promise<CampaignRecord> {
  const existing = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, strategy: true, config: true },
  })

  if (!existing) {
    throw new Error("Campaña no encontrada")
  }

  if (existing.strategy !== "CBO") {
    throw new Error("La campaña no usa estrategia CBO")
  }

  const context: CBODynamicCampaignContext = {
    budget: 0,
    landingPages: input.landingPages,
    creatives: input.creatives,
  }

  const normalizedDynamic = normalizeCBODynamicFields(input.dynamic, context)
  const validation = validateCBODynamicFields(normalizedDynamic, context)
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0]
    throw new Error(firstError ?? "Configuración CBO inválida")
  }

  const existingConfig =
    existing.strategy === "CBO"
      ? (parseCampaignStrategyConfig(existing.config) as CBOStrategyConfig | null)
      : null

  const config = rebuildCBOStrategyConfig(
    existing.name,
    normalizedDynamic,
    context,
    {
      pixelId: existingConfig?.campaign.pixel_id,
      authCode: existingConfig?.campaign.auth_code,
    }
  )

  const row = await prisma.campaign.update({
    where: { id: campaignId },
    data: { config },
  })

  return mapCampaignRecord(row)
}

export async function updateCampaignDetail(
  campaignId: string,
  input: {
    name: string
    status: CampaignStatus
    pixelId?: string
    authCode?: string
    abo?: UpdateCampaignABOInput
    cbo?: UpdateCampaignCBOInput
  }
): Promise<CampaignRecord> {
  const existing = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, strategy: true, config: true },
  })

  if (!existing) {
    throw new Error("Campaña no encontrada")
  }

  const trimmedName = input.name.trim()
  if (!trimmedName) {
    throw new Error("El nombre de la campaña es obligatorio")
  }

  if (!isCampaignStatus(input.status)) {
    throw new Error("Estado no válido")
  }

  if (!isTikTokStrategyId(existing.strategy)) {
    throw new Error("Estrategia inválida")
  }

  let config: CampaignStrategyConfig | undefined
  const existingAboConfig =
    existing.strategy === "ABO"
      ? (parseCampaignStrategyConfig(existing.config) as ABOStrategyConfig | null)
      : null
  const existingCboConfig =
    existing.strategy === "CBO"
      ? (parseCampaignStrategyConfig(existing.config) as CBOStrategyConfig | null)
      : null

  if (existing.strategy === "ABO" && input.abo) {
    const context: ABODynamicCampaignContext = {
      budget: 0,
      landingPages: input.abo.landingPages,
      creatives: input.abo.creatives,
    }

    const normalizedDynamic = normalizeABODynamicFields(input.abo.dynamic, context)
    const validation = validateABODynamicFields(normalizedDynamic, context)
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0]
      throw new Error(firstError ?? "Configuración ABO inválida")
    }

    config = rebuildABOStrategyConfig(trimmedName, normalizedDynamic, context, {
      pixelId: input.pixelId?.trim() || existingAboConfig?.campaign.pixel_id,
      authCode:
        input.authCode !== undefined
          ? input.authCode
          : existingAboConfig?.campaign.auth_code,
    })
  } else if (existing.strategy === "CBO" && input.cbo) {
    const context: CBODynamicCampaignContext = {
      budget: 0,
      landingPages: input.cbo.landingPages,
      creatives: input.cbo.creatives,
    }

    const normalizedDynamic = normalizeCBODynamicFields(input.cbo.dynamic, context)
    const validation = validateCBODynamicFields(normalizedDynamic, context)
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0]
      throw new Error(firstError ?? "Configuración CBO inválida")
    }

    config = rebuildCBOStrategyConfig(trimmedName, normalizedDynamic, context, {
      pixelId: input.pixelId?.trim() || existingCboConfig?.campaign.pixel_id,
      authCode:
        input.authCode !== undefined
          ? input.authCode
          : existingCboConfig?.campaign.auth_code,
    })
  } else if (
    (input.pixelId?.trim() || input.authCode !== undefined) &&
    existingAboConfig
  ) {
    const nextAuthCode =
      input.authCode !== undefined
        ? input.authCode.trim() || undefined
        : existingAboConfig.campaign.auth_code
    config = {
      ...existingAboConfig,
      campaign: {
        ...existingAboConfig.campaign,
        ...(input.pixelId?.trim()
          ? { pixel_id: input.pixelId.trim() }
          : {}),
        ...(nextAuthCode
          ? { auth_code: nextAuthCode }
          : { auth_code: undefined }),
      },
    }
  } else if (
    (input.pixelId?.trim() || input.authCode !== undefined) &&
    existingCboConfig
  ) {
    const nextAuthCode =
      input.authCode !== undefined
        ? input.authCode.trim() || undefined
        : existingCboConfig.campaign.auth_code
    config = {
      ...existingCboConfig,
      campaign: {
        ...existingCboConfig.campaign,
        ...(input.pixelId?.trim()
          ? { pixel_id: input.pixelId.trim() }
          : {}),
        ...(nextAuthCode
          ? { auth_code: nextAuthCode }
          : { auth_code: undefined }),
      },
    }
  }

  const row = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      name: trimmedName,
      status: input.status,
      ...(config ? { config } : {}),
    },
  })

  return mapCampaignRecord(row)
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const existing = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true },
  })
  if (!existing) {
    throw new Error("Campaña no encontrada")
  }
  if (!canDeleteCampaign(existing.status)) {
    throw new Error(
      "Solo se pueden eliminar campañas en Borrador, Listo o En curso."
    )
  }
  await prisma.campaign.delete({ where: { id: campaignId } })
}
