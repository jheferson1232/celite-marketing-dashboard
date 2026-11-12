"use server"

import { requireSessionOrRedirect } from "@/lib/auth/server"
import { safeRedirectPath } from "@/lib/auth/session"
import { createChat } from "@/lib/chat/chat-store"
import { createServerAction } from "@/lib/create-server-action"
import { redirect } from "next/navigation"

export const createAssistantChatAction = createServerAction(
  async (): Promise<{ id: string }> => {
    const id = await createChat()
    return { id }
  }
)

export async function createDashboardChat(formData: FormData) {
  await requireSessionOrRedirect()
  const returnPath = safeRedirectPath(
    String(formData.get("returnPath") || ""),
    "/dashboard"
  )
  const id = await createChat()
  redirect(`${returnPath}?chat=${id}&assistant=true`)
}
