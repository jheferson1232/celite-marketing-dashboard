"use server"

import { createChat } from "@/lib/chat/chat-store"
import { createServerAction } from "@/lib/server-action"
import { redirect } from "next/navigation"

export const createAssistantChatAction = createServerAction(
  async (): Promise<{ id: string }> => {
    const id = await createChat()
    return { id }
  }
)

export async function createDashboardChat(formData: FormData) {
  const returnPath = String(formData.get("returnPath") || "/dashboard")
  const id = await createChat()
  redirect(`${returnPath}?chat=${id}&assistant=true`)
}
