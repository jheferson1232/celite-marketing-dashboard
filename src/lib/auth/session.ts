/**
 * Sesión con clave maestra única (APP_PASSWORD), sin usuarios ni tablas.
 *
 * El token de la cookie es `v1.<expiraEnSegundos>.<firma>`, donde la firma es
 * HMAC-SHA256 con la propia APP_PASSWORD como clave. Cambiar la clave en el
 * entorno invalida todas las sesiones abiertas.
 *
 * Solo usa Web Crypto para funcionar igual en `proxy.ts` y en server actions.
 */

export const SESSION_COOKIE = "celite_session"
/** Página a la que se entra tras el login cuando no hay `next`. */
export const DEFAULT_AFTER_LOGIN_PATH = "/resumen"
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const TOKEN_VERSION = "v1"
const encoder = new TextEncoder()

export function getAppPassword(): string | null {
  return process.env.APP_PASSWORD?.trim() || null
}

export function isAuthConfigured(): boolean {
  return getAppPassword() != null
}

function importHmacKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  )
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = ""
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function signedPayload(expiresAt: number): string {
  return `${TOKEN_VERSION}.${expiresAt}`
}

export async function createSessionToken(password: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  const payload = signedPayload(expiresAt)
  const key = await importHmacKey(password, "sign")
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload))
  return `${payload}.${toBase64Url(signature)}`
}

/** true si el token está firmado con la clave actual y no expiró. */
export async function verifySessionToken(
  token: string | undefined | null,
  password: string | null
): Promise<boolean> {
  if (!token || !password) return false

  const [version, expiresRaw, signatureRaw, ...rest] = token.split(".")
  if (version !== TOKEN_VERSION || !expiresRaw || !signatureRaw || rest.length > 0) {
    return false
  }

  const expiresAt = Number(expiresRaw)
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false
  }

  const signature = fromBase64Url(signatureRaw)
  if (!signature) return false

  const key = await importHmacKey(password, "verify")
  // subtle.verify compara en tiempo constante.
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(signedPayload(expiresAt))
  )
}

/**
 * Ruta interna segura para volver tras el login. Rechaza URLs absolutas,
 * `//otro-sitio` y `/\otro-sitio` (open redirect); en esos casos, y para la
 * raíz `/`, devuelve `fallback`.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN_PATH
): string {
  const value = raw?.trim()
  if (!value || !value.startsWith("/") || value === "/") return fallback
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback
  if (value === "/login" || value.startsWith("/login?")) return fallback
  return value
}
