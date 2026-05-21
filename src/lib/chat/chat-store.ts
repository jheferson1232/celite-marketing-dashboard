import { generateId, type UIMessage } from "ai"
import prisma from "@/lib/prisma"

async function withChatDb<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.error(`[chat-store] ${label} failed`, error)
    return fallback
  }
}

export async function createChat(title?: string): Promise<string> {
  const id = generateId()
  await prisma.chat.create({
    data: {
      id,
      title: title ?? "Nueva conversación",
    },
  })
  return id
}

export async function loadChats() {
  return withChatDb(
    "loadChats",
    () =>
      prisma.chat.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      }),
    []
  )
}

export type ChatListItem = Awaited<ReturnType<typeof loadChats>>[number]

export async function loadChat(chatId: string): Promise<UIMessage[]> {
  return withChatDb(
    "loadChat",
    async () => {
      const messages = await prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
      })

      return messages.map((msg) => ({
        id: msg.id,
        role: msg.role as UIMessage["role"],
        parts: msg.parts as UIMessage["parts"],
      }))
    },
    []
  )
}

function dedupeMessagesById(messages: UIMessage[]): UIMessage[] {
  const byId = new Map<string, UIMessage>()
  for (const msg of messages) {
    byId.set(msg.id, msg)
  }
  return [...byId.values()]
}

export async function saveChat(chatId: string, messages: UIMessage[]) {
  const uniqueMessages = dedupeMessagesById(messages)

  await prisma.chat.upsert({
    where: { id: chatId },
    update: {
      updatedAt: new Date(),
      title:
        uniqueMessages
          .find((m) => m.role === "user")
          ?.parts.filter((p) => p.type === "text")
          .map((p) => (p.type === "text" ? p.text : ""))
          .join("")
          .slice(0, 80) || undefined,
    },
    create: { id: chatId },
  })

  await prisma.$transaction(
    uniqueMessages.map((msg) =>
      prisma.message.upsert({
        where: { id: msg.id },
        update: {
          role: msg.role,
          parts: msg.parts as object,
        },
        create: {
          id: msg.id,
          chatId,
          role: msg.role,
          parts: msg.parts as object,
        },
      })
    )
  )
}

export async function deleteChat(chatId: string) {
  await prisma.chat.delete({ where: { id: chatId } })
}
