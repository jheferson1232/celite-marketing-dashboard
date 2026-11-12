import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ServerActionError } from "@/lib/server-action"
import {
  getAppPassword,
  SESSION_COOKIE,
  verifySessionToken,
} from "./session"

export const UNAUTHENTICATED_MESSAGE =
  "Tu sesión expiró. Vuelve a ingresar la clave."

export class UnauthenticatedError extends ServerActionError {
  constructor() {
    super(UNAUTHENTICATED_MESSAGE)
    this.name = "UnauthenticatedError"
  }
}

export async function hasValidSession(): Promise<boolean> {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, getAppPassword())
}

/** Lanza UnauthenticatedError si la petición no trae una sesión válida. */
export async function requireSession(): Promise<void> {
  if (!(await hasValidSession())) {
    throw new UnauthenticatedError()
  }
}

/**
 * Para server actions de formulario (`<form action>`) que no usan
 * createServerAction: sin sesión, manda al login.
 */
export async function requireSessionOrRedirect(): Promise<void> {
  if (!(await hasValidSession())) {
    redirect("/login")
  }
}

/** Compara la clave ingresada con APP_PASSWORD en tiempo constante. */
export function isCorrectPassword(input: string): boolean {
  const expected = getAppPassword()
  if (!expected) return false
  const digest = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(digest(input), digest(expected))
}
