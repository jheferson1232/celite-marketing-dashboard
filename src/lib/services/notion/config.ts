import { ServerActionError } from "@/lib/server-action"

const NOTION_VERSION = "2022-06-28"

export function getNotionToken(): string {
  const token = process.env.NOTION_TOKEN?.trim()
  if (!token) {
    throw new ServerActionError(
      "Falta NOTION_TOKEN en .env. Crea una integración en notion.so/my-integrations y pega el token."
    )
  }
  return token
}

export function getNotionCampaignsDatabaseId(): string {
  const id = process.env.NOTION_CAMPAIGNS_DB?.trim()
  if (!id) {
    throw new ServerActionError(
      "Falta NOTION_CAMPAIGNS_DB en .env. Es el ID de la base Campañas (32 caracteres, sin guiones en la URL)."
    )
  }
  return id
}

export function getNotionHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getNotionToken()}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  }
}
