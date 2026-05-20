const HIDDEN_METRIC =
  /\b(impresiones|impressions|clics?|clicks?|ctr|cpm|roas)\b/i

/** Quita líneas de métricas que no queremos en Telegram. */
export function filterTelegramMetrics(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      if (HIDDEN_METRIC.test(trimmed)) return false
      return true
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** Convierte Markdown del asistente a HTML compatible con Telegram. */
export function markdownToTelegramHtml(text: string): string {
  const filtered = filterTelegramMetrics(text)

  let withBold = filtered
    .replace(/^###\s+(.+)$/gm, "<b>$1</b>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")

  return escapeHtmlPreservingBold(withBold)
}

function escapeHtmlPreservingBold(text: string): string {
  const BOLD_OPEN = "\uE000"
  const BOLD_CLOSE = "\uE001"

  const protectedText = text
    .replace(/<b>/g, BOLD_OPEN)
    .replace(/<\/b>/g, BOLD_CLOSE)

  const escaped = escapeHtml(protectedText)

  return escaped.replaceAll(BOLD_OPEN, "<b>").replaceAll(BOLD_CLOSE, "</b>")
}

export function formatAssistantReplyForTelegram(text: string): string {
  return markdownToTelegramHtml(text)
}
