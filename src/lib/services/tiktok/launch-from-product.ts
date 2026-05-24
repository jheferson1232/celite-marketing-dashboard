import {
  getProductById,
  linkProductCampaign,
  updateProductStatus,
  type ProductRecord,
} from "@/lib/services/product"
import { productToLaunchDraft } from "./launch-draft"
import {
  formatLaunchCampaignMessage,
  launchTikTokCampaignFromLaunchDraft,
  previewLaunchFromDraft,
  type LaunchCampaignOptions,
  type LaunchCampaignSummary,
} from "./launch-orchestrator"
import type { LaunchPreflightResult } from "./launch-preflight"

export type LaunchFromProductSummary = LaunchCampaignSummary & {
  productId: string
}

const LAUNCHABLE_STATUSES = new Set(["ready", "draft"])

export async function getProductForTikTokLaunch(
  productId: string
): Promise<ProductRecord> {
  const product = await getProductById(productId)
  if (!product) {
    throw new Error("Producto no encontrado")
  }
  if (!LAUNCHABLE_STATUSES.has(product.status)) {
    throw new Error(
      `El producto debe estar en Draft o Ready para lanzar (estado actual: ${product.status}).`
    )
  }
  return product
}

export async function previewLaunchFromProduct(
  productId: string,
  videosDir: string
): Promise<LaunchPreflightResult> {
  const product = await getProductForTikTokLaunch(productId)
  return previewLaunchFromDraft(productToLaunchDraft(product), videosDir)
}

export async function launchTikTokCampaignFromProduct(
  productId: string,
  options: LaunchCampaignOptions = {}
): Promise<{ message: string; summary: LaunchFromProductSummary }> {
  const product = await getProductForTikTokLaunch(productId)
  const launchDraft = productToLaunchDraft(product)

  const summary = await launchTikTokCampaignFromLaunchDraft(
    launchDraft,
    options,
    async (result) => {
      await linkProductCampaign({
        productId: product.id,
        campaignId: result.campaignId,
        campaignName: product.name,
        platform: "tiktok",
      })
      await updateProductStatus(product.id, "running")
    }
  )

  return {
    message: formatLaunchCampaignMessage(summary),
    summary: {
      ...summary,
      productId: product.id,
    },
  }
}
