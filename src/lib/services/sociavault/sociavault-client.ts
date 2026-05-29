import axios, { type AxiosInstance } from "axios"
import { ServerActionError } from "@/lib/server-action"

let sociavaultClient: AxiosInstance | null = null

export function getSociaVaultClient(): AxiosInstance {
  if (!sociavaultClient) {
    const apiKey = process.env.SOCIAVAULT_API_KEY?.trim()
    if (!apiKey) {
      throw new ServerActionError(
        "SOCIAVAULT_API_KEY es requerida. Obtén la clave en https://sociavault.com/dashboard"
      )
    }

    sociavaultClient = axios.create({
      baseURL: "https://api.sociavault.com",
      headers: {
        "X-API-Key": apiKey,
      },
      timeout: 60_000,
    })
  }

  return sociavaultClient
}
