"use server"

import { createServerAction } from "@/lib/server-action"
import { listPendingProducts } from "@/lib/services/product-pending/list-pending-products"
import { addManualPendingProduct } from "@/lib/services/product-pending/add-manual-pending-product"
import { searchPendingProductInSociaVault } from "@/lib/services/product-pending/search-pending-product-sociavault"
import { deletePendingMatch } from "@/lib/services/product-pending/delete-pending-match"
import { deletePendingProduct } from "@/lib/services/product-pending/delete-pending-product"
import { savePendingMatchMedia } from "@/lib/services/product-pending/save-pending-match-media"
import { favoritePendingMatchToBaul } from "@/lib/services/product-pending/favorite-pending-match-to-baul"
import { togglePendingMatchFavorite } from "@/lib/services/product-pending/toggle-pending-match-favorite"
import { isSociaVaultApiKeyConfigured } from "@/lib/services/sociavault/sociavault-setup"

export const listPendingProductsAction = createServerAction(async () =>
  listPendingProducts()
)

export const getSociaVaultSetupStatusAction = createServerAction(async () => ({
  configured: isSociaVaultApiKeyConfigured(),
}))

export const addManualPendingProductAction = createServerAction(
  async (input: {
    name: string
    dropiId?: string
    url?: string
    imageUrl?: string
    imageUrls?: string[]
    price?: number
  }) => addManualPendingProduct(input)
)

export const searchPendingProductSociaVaultAction = createServerAction(
  async (productId: string) => searchPendingProductInSociaVault(productId)
)

export const togglePendingMatchFavoriteAction = createServerAction(
  async (matchId: string) => togglePendingMatchFavorite(matchId)
)

export const favoritePendingMatchToBaulAction = createServerAction(
  async (input: { matchId: string; variantIds: string[] }) =>
    favoritePendingMatchToBaul(input.matchId, input.variantIds)
)

export const deletePendingMatchAction = createServerAction(async (matchId: string) =>
  deletePendingMatch(matchId)
)

export const deletePendingProductAction = createServerAction(
  async (productId: string) => deletePendingProduct(productId)
)

export const savePendingMatchMediaAction = createServerAction(
  async (input: {
    matchId: string
    media: { coverUrl?: string | null; videoUrl?: string | null }
  }) => savePendingMatchMedia(input.matchId, input.media)
)
