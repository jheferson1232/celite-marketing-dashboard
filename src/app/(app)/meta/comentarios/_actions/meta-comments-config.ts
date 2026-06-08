"use server"

import { createServerAction } from "@/lib/server-action"
import {
  getOrCreateMetaCommentAgentSettings,
  updateMetaCommentAgentSettings,
  type MetaCommentAgentSettingsInput,
} from "@/lib/services/meta/comments/agent-settings"
import {
  getMetaCommentAssistantTestContext,
  testMetaCommentAssistant,
} from "@/lib/services/meta/comments/assistant-test"
import {
  createMetaCommentProduct,
  deleteMetaCommentProduct,
  getMetaCommentProduct,
  listMetaCommentProducts,
  updateMetaCommentProduct,
  type MetaCommentProductInput,
} from "@/lib/services/meta/comments/products"
import { listMetaCommentPageConfigs } from "@/lib/services/meta/comments/page-config"

export const getMetaCommentAgentSettingsAction = createServerAction(async () =>
  getOrCreateMetaCommentAgentSettings()
)

export const updateMetaCommentAgentSettingsAction = createServerAction(
  async (input: MetaCommentAgentSettingsInput) =>
    updateMetaCommentAgentSettings(input)
)

export const listMetaCommentProductsAction = createServerAction(async () =>
  listMetaCommentProducts()
)

export const getMetaCommentProductAction = createServerAction(async (id: string) =>
  getMetaCommentProduct(id)
)

export const createMetaCommentProductAction = createServerAction(
  async (input: MetaCommentProductInput) => createMetaCommentProduct(input)
)

export const updateMetaCommentProductAction = createServerAction(
  async (input: { id: string; data: MetaCommentProductInput }) =>
    updateMetaCommentProduct(input.id, input.data)
)

export const deleteMetaCommentProductAction = createServerAction(
  async (id: string) => {
    await deleteMetaCommentProduct(id)
    return { ok: true }
  }
)

export const getMetaCommentAssistantTestContextAction = createServerAction(
  async (input?: { pageId?: string | null; productId?: string | null }) =>
    getMetaCommentAssistantTestContext(input)
)

export const testMetaCommentAssistantAction = createServerAction(
  async (input: {
    message: string
    pageId?: string | null
    productId?: string | null
  }) => testMetaCommentAssistant(input)
)

export const listMetaCommentPagesForTestAction = createServerAction(async () =>
  listMetaCommentPageConfigs()
)
