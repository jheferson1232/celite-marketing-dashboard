import "server-only"

import { requireSession, UnauthenticatedError } from "@/lib/auth/server"
import { ServerActionError, type ServerActionResponse } from "@/lib/server-action"

function toErrorResponse(error: unknown): ServerActionResponse<undefined> {
  if (error instanceof UnauthenticatedError) {
    return {
      ok: false,
      code: "UNAUTHENTICATED",
      result: undefined,
      errorMessage: error.message,
    }
  }

  console.error(error)

  const metaError = (error as { response?: { data?: { error?: unknown } } })
    ?.response?.data?.error as
    | {
        error_user_msg?: string
        message?: string
      }
    | undefined

  const metaUserMessage = metaError?.error_user_msg || metaError?.message

  const message =
    metaUserMessage ||
    (error instanceof ServerActionError
      ? error.message
      : error instanceof Error && error.message.trim()
        ? error.message
        : "Error desconocido al ejecutar acción. Contacta al desarrollador.")

  return {
    ok: false,
    result: undefined,
    errorMessage: message,
  }
}

/**
 * Envuelve una función de servicio como server action.
 * Exige sesión válida (APP_PASSWORD) antes de ejecutar nada.
 */
export function createServerAction<R, A = void>(action: (args: A) => Promise<R>) {
  return async (args: A) =>
    [
      requireSession()
        .then(() => action(args))
        .then(
          (result): ServerActionResponse<R> => ({
            ok: true,
            result,
            errorMessage: undefined,
          })
        )
        .catch(toErrorResponse),
    ] as const
}
