import type { ChatPlatform } from "@/lib/chat/kpi-response"
import { createChat } from "@/lib/chat/chat-store"
import prisma from "@/lib/prisma"

export async function getTelegramSession(telegramUserId: string) {
  return prisma.telegramSession.findUnique({
    where: { telegramUserId },
  })
}

export async function createTelegramSession(
  telegramUserId: string,
  platform: ChatPlatform = "meta"
) {
  const chatId = await createChat("Telegram")
  return prisma.telegramSession.create({
    data: {
      telegramUserId,
      chatId,
      platform,
    },
  })
}

export async function resetTelegramSession(
  telegramUserId: string,
  platform: ChatPlatform = "meta"
) {
  const existing = await getTelegramSession(telegramUserId)
  if (existing) {
    await prisma.chat.delete({ where: { id: existing.chatId } })
  }
  return createTelegramSession(telegramUserId, platform)
}

export async function setTelegramPlatform(
  telegramUserId: string,
  platform: ChatPlatform
) {
  return prisma.telegramSession.update({
    where: { telegramUserId },
    data: { platform, updatedAt: new Date() },
  })
}

export async function getOrCreateTelegramSession(telegramUserId: string) {
  const existing = await getTelegramSession(telegramUserId)
  if (existing) return existing
  return createTelegramSession(telegramUserId)
}

export function inferPlatformFromText(
  text: string,
  defaultPlatform: ChatPlatform
): ChatPlatform {
  const lower = text.toLowerCase()

  const wantsTikTok = /\btik\s*tok\b|\btiktok\b/.test(lower)
  const wantsMeta =
    /\bmeta\b|\bfacebook\b|\binstagram\b|\bface\s*book\b/.test(lower)
  const wantsBoth =
    /\bambos\b|\blas\s+dos\b|\bfacebook\s+y\s+tiktok\b|\bmeta\s+y\s+tiktok\b/.test(
      lower
    )

  if (wantsBoth || (wantsTikTok && wantsMeta)) return defaultPlatform
  if (wantsTikTok) return "tiktok"
  if (wantsMeta) return "meta"
  return defaultPlatform
}
