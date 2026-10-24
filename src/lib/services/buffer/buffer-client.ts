import axios, { AxiosError, type AxiosInstance } from "axios"
import { ServerActionError } from "@/lib/server-action"

const BUFFER_API_URL = "https://api.buffer.com"

let client: AxiosInstance | null = null

function getClient(): AxiosInstance {
  if (client) return client

  const apiKey = process.env.BUFFER_API_KEY?.trim()
  if (!apiKey) {
    throw new ServerActionError(
      "Falta BUFFER_API_KEY en este servidor. En local va en .env.local; en Vercel, en Environment Variables, y hay que volver a desplegar."
    )
  }

  client = axios.create({
    baseURL: BUFFER_API_URL,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  })

  return client
}

type GraphqlResponse<T> = {
  data?: T
  errors?: Array<{ message?: string }>
}

export async function bufferQuery<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  try {
    const response = await getClient().post<GraphqlResponse<T>>("", {
      query,
      variables,
    })
    const errors = response.data.errors?.flatMap((error) =>
      error.message ? [error.message] : []
    )
    if (errors && errors.length > 0) {
      throw new ServerActionError(errors.join(" "))
    }
    if (!response.data.data) {
      throw new ServerActionError("Buffer no devolvió datos.")
    }
    return response.data.data
  } catch (error) {
    if (error instanceof ServerActionError) throw error
    if (error instanceof AxiosError) {
      if (error.response?.status === 401) {
        throw new ServerActionError("Buffer rechazó la clave API.")
      }
      const payload = error.response?.data as GraphqlResponse<unknown> | undefined
      const message = payload?.errors
        ?.flatMap((item) => (item.message ? [item.message] : []))
        .join(" ")
      throw new ServerActionError(message || "No se pudo consultar Buffer.")
    }
    throw error
  }
}
