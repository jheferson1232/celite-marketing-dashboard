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

          const metaUserMessage = error?.response?.data?.error?.error_user_msg as
            | string
            | undefined

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
  const data = await (await createdAction)[0]

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
