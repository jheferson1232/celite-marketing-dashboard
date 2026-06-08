import { getOrCreateMetaCommentAgentSettings } from "./agent-settings"
import { classifyMetaComment } from "./classify"
import { isAnthropicConfigured } from "./env"
import { listMetaCommentPageConfigs } from "./page-config"
import {
  getMetaCommentProduct,
  listActiveMetaCommentProducts,
} from "./products"
import type {
  MetaCommentActionKind,
  MetaCommentClassification,
} from "./types"

export type MetaCommentAssistantTestContext = {
  keyword: string | null
  productName: string | null
  pageName: string | null
  productsCount: number
}

export type MetaCommentAssistantTestResult = {
  classification: MetaCommentClassification
  action: MetaCommentActionKind
  replyText: string | null
  context: MetaCommentAssistantTestContext
}

export async function getMetaCommentAssistantTestContext(input?: {
  pageId?: string | null
  productId?: string | null
}): Promise<MetaCommentAssistantTestContext> {
  const [products, pages] = await Promise.all([
    listActiveMetaCommentProducts(),
    listMetaCommentPageConfigs(),
  ])

  const product = input?.productId
    ? products.find((p) => p.id === input.productId) ??
      (await getMetaCommentProduct(input.productId))
    : products[0] ?? null

  const page = input?.pageId
    ? pages.find((p) => p.pageId === input.pageId)
    : pages.find((p) => p.enabled) ?? pages[0]

  const keyword = product?.tags[0]?.trim() || product?.name?.trim() || null

  return {
    keyword,
    productName: product?.name ?? null,
    pageName: page?.pageName ?? null,
    productsCount: products.length,
  }
}

export async function testMetaCommentAssistant(input: {
  message: string
  pageId?: string | null
  productId?: string | null
}): Promise<MetaCommentAssistantTestResult> {
  if (!isAnthropicConfigured()) {
    throw new Error("ANTHROPIC_API_KEY es requerida para probar el asistente")
  }

  const message = input.message.trim()
  if (!message) {
    throw new Error("Escribí un comentario de prueba")
  }

  const [agentSettings, products, pages, context] = await Promise.all([
    getOrCreateMetaCommentAgentSettings(),
    listActiveMetaCommentProducts(),
    listMetaCommentPageConfigs(),
    getMetaCommentAssistantTestContext(input),
  ])

  const product = input.productId
    ? products.find((p) => p.id === input.productId) ??
      (await getMetaCommentProduct(input.productId))
    : products[0] ?? null

  const activeProducts = product ? [product] : products

  const page = input.pageId
    ? pages.find((p) => p.pageId === input.pageId)
    : pages.find((p) => p.enabled) ?? pages[0]

  const decision = await classifyMetaComment(message, {
    replyMode: page?.replyMode,
    replyTemplate: page?.replyTemplate,
    websiteUrl: page?.websiteUrl,
    pageName: page?.pageName ?? null,
    agentSettings,
    products: activeProducts,
  })

  return {
    ...decision,
    context,
  }
}
