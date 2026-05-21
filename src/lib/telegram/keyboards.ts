import type { InlineKeyboardButton, ReplyKeyboardMarkup } from "./bot"

/** Textos que envía el teclado fijo (deben coincidir al comparar). */
export const REPLY_SHORTCUT = {
  GASTO_HOY: "📊 Gasto total hoy",
  GASTO_AYER: "📅 Gasto total ayer",
  FB_ACTIVAS: "📘 FB campañas activas",
  TT_ACTIVAS: "🎵 TT campañas activas",
  TT_CONJUNTOS: "🎯 TT conjuntos activos",
} as const

export type ReplyShortcutText =
  (typeof REPLY_SHORTCUT)[keyof typeof REPLY_SHORTCUT]

const ALL_SHORTCUT_TEXTS: string[] = Object.values(REPLY_SHORTCUT)

export function isReplyShortcutText(text: string): text is ReplyShortcutText {
  return ALL_SHORTCUT_TEXTS.includes(text.trim())
}

export function getTelegramReplyKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [
      [
        { text: REPLY_SHORTCUT.GASTO_HOY },
        { text: REPLY_SHORTCUT.GASTO_AYER },
      ],
      [
        { text: REPLY_SHORTCUT.FB_ACTIVAS },
        { text: REPLY_SHORTCUT.TT_ACTIVAS },
      ],
      [{ text: REPLY_SHORTCUT.TT_CONJUNTOS }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  }
}

export function getCancelInlineKeyboard(): InlineKeyboardButton[][] {
  return [[{ text: "❌ Cancelar", callback_data: "x" }]]
}

export function getConfirmCancelRow(
  confirmData: string
): InlineKeyboardButton[][] {
  return [
    [
      { text: "✅ Confirmar", callback_data: confirmData },
      { text: "❌ Cancelar", callback_data: "x" },
    ],
  ]
}
