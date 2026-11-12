"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { isCorrectPassword } from "@/lib/auth/server"
import {
  createSessionToken,
  getAppPassword,
  safeRedirectPath,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session"

// Server actions de formulario (useActionState): no usan createServerAction
// porque login no puede exigir sesión y redirect() debe propagarse.

export type LoginState = { error: string | null }

const FAILED_LOGIN_DELAY_MS = 1_000

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = getAppPassword()
  if (!password) {
    return {
      error: "Falta configurar APP_PASSWORD en el servidor.",
    }
  }

  const input = String(formData.get("password") ?? "")
  if (!input || !isCorrectPassword(input)) {
    // Frena intentos automáticos sin necesidad de guardar estado.
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS))
    return { error: "Clave incorrecta." }
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, await createSessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })

  redirect(safeRedirectPath(String(formData.get("next") ?? "")))
}

export async function logoutAction(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect("/login")
}
