import { ServerActionError } from "@/lib/server-action"

export type DropiSession = {
  token: string
  userId: string
  countryHost: string
}

type DropiLoginResult = {
  objects?: { id?: number | string }
  token?: string
  countries?: Array<{ code?: string }>
}

let cachedSession: DropiSession | null = null

export function primeDropiSession(session: DropiSession): void {
  cachedSession = session
}

export function clearDropiSessionCache(): void {
  cachedSession = null
}

export function hasDropiApiSession(): boolean {
  return Boolean(
    cachedSession ||
      process.env.DROPI_TOKEN?.trim() ||
      process.env.DROPI_LOGIN_RESULT_JSON?.trim()
  )
}

function parseDropiToken(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('"')) {
    const parts = trimmed.split('"')
    if (parts[1]) return parts[1]
  }
  return trimmed.replace(/^Bearer\s+/i, "")
}

export function sessionFromLoginPayload(
  tokenRaw: string,
  loginResult: DropiLoginResult | null
): DropiSession {
  const token = parseDropiToken(tokenRaw)
  if (!token) {
    throw new ServerActionError("Token de Dropi vacío tras el login.")
  }

  const userId =
    process.env.DROPI_USER_ID?.trim() ??
    String(loginResult?.objects?.id ?? "").trim()
  if (!userId) {
    throw new ServerActionError(
      "No se obtuvo el ID de usuario de Dropi. Configura DROPI_USER_ID o vuelve a iniciar sesión."
    )
  }

  const countryHost =
    process.env.DROPI_COUNTRY_HOST?.trim().toLowerCase() ??
    loginResult?.countries?.[0]?.code?.toLowerCase() ??
    "co"

  return { token, userId, countryHost }
}

export function getDropiSession(): DropiSession {
  if (cachedSession) return cachedSession

  const loginJson = process.env.DROPI_LOGIN_RESULT_JSON?.trim()
  const tokenRaw = process.env.DROPI_TOKEN?.trim()

  let loginResult: DropiLoginResult | null = null
  if (loginJson) {
    try {
      loginResult = JSON.parse(loginJson) as DropiLoginResult
    } catch {
      throw new ServerActionError("DROPI_LOGIN_RESULT_JSON no es JSON válido")
    }
  }

  const token = parseDropiToken(
    tokenRaw ?? (typeof loginResult?.token === "string" ? loginResult.token : "")
  )
  if (!token) {
    throw new ServerActionError(
      "Configura DROPI_TOKEN (o DROPI_LOGIN_RESULT_JSON). Inicia sesión en app.dropi.co → F12 → Application → Local Storage → copia DROPI_token."
    )
  }

  cachedSession = sessionFromLoginPayload(token, loginResult)
  return cachedSession
}
