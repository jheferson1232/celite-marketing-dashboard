// NOTA: Esta funcion es una copia de la funcion de next-server-actions-parallel
// Modificado para manejar los errores ya que al combinar server actions con react-query no se pueden capturar

import { useMutation, type UseMutationOptions } from '@tanstack/react-query'

export type ServerActionResponse<T> = {
  ok: boolean
  errorMessage?: string
  result: T
}

export class ServerActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerActionError'
  }
}

export function createServerAction<R, A = void>(action: (args: A) => Promise<R>) {
  return async (args: A) =>
    [
      action(args)
        .then((result) => ({
          ok: true,
          result,
          errorMessage: undefined
        }))
        .catch((error) => {
          console.error(error)

          const metaError = error?.response?.data?.error as
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
            errorMessage: message
          }
        })
    ] as const
}

export async function runServerAction<T>(
  createdAction: Promise<readonly [Promise<ServerActionResponse<T>>]>
) {
  let data: ServerActionResponse<T>

  try {
    data = await (await createdAction)[0]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (
      message.includes('Server Action') ||
      message.includes('server action') ||
      message.includes('404')
    ) {
      throw new Error(
        'La app se recargó en segundo plano. Refresca la página (F5) e inténtalo otra vez.'
      )
    }
    if (message.includes('unexpected response')) {
      throw new Error(
        'No se pudo completar la subida. Si el archivo es un video grande, espera unos segundos e inténtalo de nuevo. Si persiste, recarga la página (F5).'
      )
    }
    throw error
  }

  if (data.ok === false) {
    throw new Error(data.errorMessage || 'Error desconocido')
  }

  return data.result
}

type CreatedServerAction<R, A> = (args: A) => Promise<readonly [Promise<ServerActionResponse<R>>]>

export function useServerAction<R, A = void>(
  serverAction: CreatedServerAction<R, A>,
  options?: Omit<UseMutationOptions<R | undefined, Error, A>, 'mutationFn'>
) {
  return useMutation<R | undefined, Error, A>({
    mutationFn: (args: A) => runServerAction(serverAction(args)),
    ...options
  })
}
