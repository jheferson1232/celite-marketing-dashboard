import { ServerActionError } from "@/lib/server-action"
import { launchChromiumBrowser } from "./playwright-browser"
import {
  primeDropiSession,
  sessionFromLoginPayload,
  type DropiSession,
} from "./dropi-session"

const DROPI_LOGIN_URL =
  process.env.DROPI_LOGIN_URL?.trim() || "https://app.dropi.co/login"

type DropiLoginResult = {
  objects?: { id?: number | string }
  token?: string
  countries?: Array<{ code?: string }>
}

/** Login en Dropi con email/contraseña y extrae token del localStorage (sin importar favoritos). */
export async function obtainDropiSessionViaPlaywright(): Promise<DropiSession> {
  const email = process.env.DROPI_EMAIL?.trim()
  const password = process.env.DROPI_PASSWORD?.trim()
  if (!email || !password) {
    throw new ServerActionError(
      "Configura DROPI_EMAIL y DROPI_PASSWORD en .env para buscar productos por nombre."
    )
  }

  const browser = await launchChromiumBrowser()

  try {
    const page = await browser.newPage()
    await page.goto(DROPI_LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    })

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

    const storage = await page.evaluate(() => {
      const keys = Object.keys(localStorage)
      const loginKey =
        keys.find((k) => /loginresult/i.test(k)) ??
        "DROPI_LoginResult"
      return {
        token: localStorage.getItem("DROPI_token"),
        loginResult: localStorage.getItem(loginKey),
      }
    })

    if (!storage.token?.trim()) {
      throw new ServerActionError(
        "Login en Dropi completado pero no se encontró DROPI_token. Copia el token manualmente a DROPI_TOKEN en .env."
      )
    }

    let loginResult: DropiLoginResult | null = null
    if (storage.loginResult) {
      try {
        loginResult = JSON.parse(storage.loginResult) as DropiLoginResult
      } catch {
        loginResult = null
      }
    }

    const session = sessionFromLoginPayload(storage.token, loginResult)
    primeDropiSession(session)
    return session
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message
        : "No se pudo iniciar sesión en Dropi con el navegador."
    throw new ServerActionError(
      `${detail} Alternativa: copia DROPI_token desde app.dropi.co (F12 → Application → Local Storage).`
    )
  } finally {
    await browser.close()
  }
}
