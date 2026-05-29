import axios, { type AxiosInstance } from "axios"
import { ServerActionError } from "@/lib/server-action"
import { getDropiSession } from "./dropi-session"
import type { DropiFavoriteRaw } from "./types"

const DROPI_API_GO = "https://api-v2.dropi.co"

function createDropiGoClient(countryHost: string, token: string): AxiosInstance {
  return axios.create({
    baseURL: DROPI_API_GO,
    timeout: 60_000,
    headers: {
      "X-Authorization": `Bearer ${token}`,
      "X-Host": countryHost,
    },
  })
}

function normalizeApiProduct(item: Record<string, unknown>): DropiFavoriteRaw | null {
  const dropiId = String(
    item.id ?? item.product_id ?? item.productId ?? ""
  ).trim()
  const name = String(
    item.name ?? item.title ?? item.product_name ?? item.productName ?? ""
  ).trim()
  if (!dropiId || !name) return null

  const priceRaw = item.sale_price ?? item.price ?? item.suggested_price
  const price =
    typeof priceRaw === "number"
      ? priceRaw
      : typeof priceRaw === "string"
        ? Number.parseFloat(priceRaw.replace(/[^\d.,]/g, "").replace(",", "."))
        : null

  return {
    dropiId,
    name,
    url:
      typeof item.url === "string"
        ? item.url
        : typeof item.link === "string"
          ? item.link
          : null,
    imageUrl:
      typeof item.image === "string"
        ? item.image
        : typeof item.imageUrl === "string"
          ? item.imageUrl
          : typeof item.main_image === "string"
            ? item.main_image
            : null,
    sku: typeof item.sku === "string" ? item.sku : null,
    price: Number.isFinite(price) ? price : null,
  }
}

function extractProducts(payload: unknown): DropiFavoriteRaw[] {
  const out = new Map<string, DropiFavoriteRaw>()

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    const obj = node as Record<string, unknown>
    const normalized = normalizeApiProduct(obj)
    if (normalized) out.set(normalized.dropiId, normalized)
    for (const value of Object.values(obj)) walk(value)
  }

  walk(payload)
  return [...out.values()]
}

function buildSearchBody(keywords: string, favoriteOnly: boolean) {
  return {
    ...(favoriteOnly ? { favorite: true, favorites: true } : {}),
    search_type: "simple",
    order_by: "created_at",
    order_type: "desc",
    page: 1,
    page_size: favoriteOnly ? 100 : 30,
    keywords,
  }
}

function dropiApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; status_reason?: string }
      | undefined
    const msg = data?.status_reason ?? data?.message
    if (msg) return msg
    if (error.response?.status === 401) {
      return "Token de Dropi inválido o expirado. Vuelve a iniciar sesión y actualiza DROPI_TOKEN."
    }
  }
  return fallback
}

/** Busca un producto por nombre en el catálogo Dropi. */
export async function fetchDropiProductsByKeyword(
  keyword: string
): Promise<DropiFavoriteRaw[]> {
  const query = keyword.trim()
  if (!query) {
    throw new ServerActionError("Indica el nombre del producto a buscar en Dropi.")
  }

  const { token, userId, countryHost } = getDropiSession()
  const client = createDropiGoClient(countryHost, token)
  const searchBody = buildSearchBody(query, false)

  let products: DropiFavoriteRaw[] = []
  try {
    const searchRes = await client.post(`/produit/${userId}/search`, searchBody)
    products = extractProducts(searchRes.data)
  } catch (error) {
    throw new ServerActionError(
      dropiApiErrorMessage(
        error,
        `No se pudo buscar "${query}" en Dropi. Verifica DROPI_TOKEN o credenciales.`
      )
    )
  }

  const q = query.toLowerCase()
  const matched = products.filter((p) => p.name.toLowerCase().includes(q))

  const result = matched.length > 0 ? matched : products.slice(0, 3)
  if (result.length === 0) {
    throw new ServerActionError(
      `No se encontró "${query}" en Dropi. Prueba otro nombre o márcalo como favorito en Dropi.`
    )
  }

  return result
}

/** Favoritos vía API Go (token del navegador o login automático). */
export async function fetchDropiFavoritesViaApi(): Promise<DropiFavoriteRaw[]> {
  const { token, userId, countryHost } = getDropiSession()
  const client = createDropiGoClient(countryHost, token)

  const searchBody = buildSearchBody("", true)

  let products: DropiFavoriteRaw[] = []

  try {
    const searchRes = await client.post(
      `/produit/${userId}/search`,
      searchBody
    )
    products = extractProducts(searchRes.data)
  } catch {
    // fallback al endpoint de favoritos
  }

  if (products.length === 0) {
    try {
      const favRes = await client.post(`/produit/${userId}/favorites`, searchBody)
      products = extractProducts(favRes.data)
    } catch (error) {
      throw new ServerActionError(
        dropiApiErrorMessage(
          error,
          "La API de Dropi no devolvió favoritos. Verifica DROPI_TOKEN."
        )
      )
    }
  }

  if (products.length === 0) {
    throw new ServerActionError(
      "La API de Dropi no devolvió favoritos. Verifica que DROPI_TOKEN no haya expirado."
    )
  }

  return products
}
