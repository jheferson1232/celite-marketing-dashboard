import { ServerActionError } from "@/lib/server-action"
import {
  fetchDropiFavoritesViaApi,
  fetchDropiProductsByKeyword,
} from "./dropi-api"
import { obtainDropiSessionViaPlaywright } from "./dropi-playwright-login"
import { hasDropiApiSession } from "./dropi-session"
import { launchChromiumBrowser } from "./playwright-browser"
import type { DropiFavoriteRaw, DropiScrapeResult } from "./types"

const DROPI_LOGIN_URL =
  process.env.DROPI_LOGIN_URL?.trim() || "https://app.dropi.co/login"
const DROPI_FAVORITES_URL =
  process.env.DROPI_FAVORITES_URL?.trim() ||
  "https://app.dropi.co/dashboard/search?search_type=simple&favorite=true&order_by=created_at&order_type=desc"

function parseFavoritesJsonOverride(): DropiFavoriteRaw[] | null {
  const raw = process.env.DROPI_FAVORITES_JSON?.trim()
  if (!raw) return null
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    throw new ServerActionError("DROPI_FAVORITES_JSON debe ser un array JSON")
  }
  return parsed.map(normalizeFavorite)
}

function normalizeFavorite(item: unknown): DropiFavoriteRaw {
  const row = item as Record<string, unknown>
  const dropiId = String(row.dropiId ?? row.id ?? row.product_id ?? "").trim()
  const name = String(row.name ?? row.title ?? row.product_name ?? "").trim()
  if (!dropiId || !name) {
    throw new ServerActionError(
      "Cada favorito debe incluir dropiId (o id) y name"
    )
  }
  const priceRaw = row.price ?? row.sale_price
  const price =
    typeof priceRaw === "number"
      ? priceRaw
      : typeof priceRaw === "string"
        ? Number.parseFloat(priceRaw.replace(/[^\d.,]/g, "").replace(",", "."))
        : null

  return {
    dropiId,
    name,
    url: typeof row.url === "string" ? row.url : null,
    imageUrl:
      typeof row.imageUrl === "string"
        ? row.imageUrl
        : typeof row.image === "string"
          ? row.image
          : null,
    sku: typeof row.sku === "string" ? row.sku : null,
    price: Number.isFinite(price) ? price : null,
  }
}

function collectFromApiPayload(
  payload: unknown,
  out: Map<string, DropiFavoriteRaw>
) {
  if (!payload || typeof payload !== "object") return

  if (Array.isArray(payload)) {
    for (const item of payload) collectFromApiPayload(item, out)
    return
  }

  const obj = payload as Record<string, unknown>

  const candidateId =
    obj.id ?? obj.product_id ?? obj.productId ?? obj.dropi_id ?? obj.dropiId
  const candidateName =
    obj.name ?? obj.title ?? obj.product_name ?? obj.productName

  if (candidateId != null && candidateName != null) {
    try {
      const fav = normalizeFavorite(obj)
      out.set(fav.dropiId, fav)
    } catch {
      // ignore partial rows
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") collectFromApiPayload(value, out)
  }
}

async function scrapeWithPlaywright(): Promise<DropiFavoriteRaw[]> {
  const email = process.env.DROPI_EMAIL?.trim()
  const password = process.env.DROPI_PASSWORD?.trim()
  if (!email || !password) {
    throw new ServerActionError(
      "Configura DROPI_EMAIL y DROPI_PASSWORD en .env (o usa DROPI_FAVORITES_JSON para pruebas)"
    )
  }

  const collected = new Map<string, DropiFavoriteRaw>()
  const browser = await launchChromiumBrowser()

  try {
    const page = await browser.newPage()

    page.on("response", async (response) => {
      const url = response.url()
      if (!/dropi\.co/i.test(url)) return
      if (!/product|favorite|search|catalog/i.test(url)) return
      if (response.status() < 200 || response.status() >= 300) return

      try {
        const contentType = response.headers()["content-type"] ?? ""
        if (!contentType.includes("json")) return
        const json = await response.json()
        collectFromApiPayload(json, collected)
      } catch {
        // ignore non-json
      }
    })

    await page.goto(DROPI_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 })

    const emailInput = page
      .locator(
        'input[type="email"], input[name="email"], input[placeholder*="mail" i], input[autocomplete="username"]'
      )
      .first()
    const passwordInput = page
      .locator('input[type="password"], input[name="password"]')
      .first()

    await emailInput.waitFor({ state: "visible", timeout: 30_000 })
    await emailInput.fill(email)
    await passwordInput.fill(password)

    const submit = page
      .locator(
        'button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Login")'
      )
      .first()
    await submit.click()

    await page.waitForURL(/dropi\.co\/(dashboard|home|search)/i, {
      timeout: 60_000,
    })

    await page.goto(DROPI_FAVORITES_URL, {
      waitUntil: "networkidle",
      timeout: 90_000,
    })

    await page.waitForTimeout(2_000)

    const domFavorites = await page.evaluate(() => {
      const results: Array<{
        dropiId: string
        name: string
        url: string | null
        imageUrl: string | null
      }> = []

      const cards = document.querySelectorAll<HTMLElement>(
        '[data-product-id], [data-id], article, .product, [class*="product"]'
      )

      for (const card of cards) {
        const dropiId =
          card.dataset.productId ||
          card.dataset.id ||
          card.getAttribute("data-product-id") ||
          ""
        const name =
          card.querySelector("h1,h2,h3,h4,[class*='title'],[class*='name']")
            ?.textContent?.trim() || card.textContent?.trim().slice(0, 120) || ""
        if (!name) continue

        const link = card.querySelector<HTMLAnchorElement>("a[href]")
        const img = card.querySelector<HTMLImageElement>("img[src]")

        results.push({
          dropiId: dropiId || name.toLowerCase().replace(/\s+/g, "-").slice(0, 80),
          name,
          url: link?.href ?? null,
          imageUrl: img?.src ?? null,
        })
      }

      return results
    })

    for (const row of domFavorites) {
      if (!row.name) continue
      collected.set(row.dropiId, {
        dropiId: row.dropiId,
        name: row.name,
        url: row.url,
        imageUrl: row.imageUrl,
        sku: null,
        price: null,
      })
    }
  } finally {
    await browser.close()
  }

  const favorites = [...collected.values()]
  if (favorites.length === 0) {
    throw new ServerActionError(
      "No se encontraron favoritos en Dropi. Verifica credenciales o ajusta DROPI_FAVORITES_URL."
    )
  }

  return favorites
}

function usePlaywrightScraper(): boolean {
  return process.env.DROPI_USE_PLAYWRIGHT?.trim().toLowerCase() === "true"
}

const DROPi_TOKEN_HELP =
  "Copia DROPI_token desde app.dropi.co (F12 → Application → Local Storage) a DROPI_TOKEN en .env, o deja DROPI_EMAIL y DROPI_PASSWORD para login automático."

async function ensureDropiApiSession(): Promise<void> {
  if (hasDropiApiSession()) return

  const email = process.env.DROPI_EMAIL?.trim()
  const password = process.env.DROPI_PASSWORD?.trim()
  if (email && password) {
    await obtainDropiSessionViaPlaywright()
    return
  }

  throw new ServerActionError(`Falta sesión de Dropi. ${DROPi_TOKEN_HELP}`)
}

function filterFavoritesByKeyword(
  favorites: DropiFavoriteRaw[],
  keyword: string
): DropiFavoriteRaw[] {
  const q = keyword.toLowerCase()
  return favorites.filter((f) => f.name.toLowerCase().includes(q))
}

export type ScrapeDropiOptions = {
  /** Si se indica, importa solo productos que coincidan (búsqueda en catálogo o filtro). */
  keyword?: string
}

/** Importa favoritos: JSON override → API (token) → Playwright (solo si DROPI_USE_PLAYWRIGHT=true). */
export async function scrapeDropiFavorites(
  options?: ScrapeDropiOptions
): Promise<DropiScrapeResult> {
  const keyword = options?.keyword?.trim()
  const jsonOverride = parseFavoritesJsonOverride()

  if (keyword) {
    try {
      await ensureDropiApiSession()
      const favorites = await fetchDropiProductsByKeyword(keyword)
      return { favorites, source: "api" }
    } catch (primaryError) {
      if (jsonOverride) {
        const fromJson = filterFavoritesByKeyword(jsonOverride, keyword)
        if (fromJson.length > 0) {
          return { favorites: fromJson, source: "json_override" }
        }
      }

      const message =
        primaryError instanceof ServerActionError
          ? primaryError.message
          : primaryError instanceof Error
            ? primaryError.message
            : "Error al buscar en Dropi."

      throw new ServerActionError(
        `${message} DROPI_FAVORITES_JSON no incluye "${keyword}". ${DROPi_TOKEN_HELP}`
      )
    }
  }

  if (jsonOverride) {
    return { favorites: jsonOverride, source: "json_override" }
  }

  if (hasDropiApiSession()) {
    const favorites = await fetchDropiFavoritesViaApi()
    return { favorites, source: "api" }
  }

  const email = process.env.DROPI_EMAIL?.trim()
  const password = process.env.DROPI_PASSWORD?.trim()

  if (email && password) {
    try {
      await ensureDropiApiSession()
      const favorites = await fetchDropiFavoritesViaApi()
      return { favorites, source: "api" }
    } catch {
      // continúa con Playwright completo si está habilitado
    }
  }

  if (!usePlaywrightScraper()) {
    throw new ServerActionError(`Falta sesión de Dropi. ${DROPi_TOKEN_HELP}`)
  }

  try {
    const favorites = await scrapeWithPlaywright()
    return { favorites, source: "playwright" }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Error al abrir el navegador"
    throw new ServerActionError(`${detail} ${DROPi_TOKEN_HELP}`)
  }
}
