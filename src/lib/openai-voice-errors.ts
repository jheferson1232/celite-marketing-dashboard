/** Mensajes claros en español para errores habituales de OpenAI / Realtime. */
export function mapOpenAiVoiceErrorMessage(raw: string): string {
  const text = raw.trim()
  const lower = text.toLowerCase()

  if (
    lower.includes("exceeded your current quota") ||
    lower.includes("insufficient_quota") ||
    lower.includes("check your plan and billing")
  ) {
    return "OpenAI sin crédito o cuota agotada. En platform.openai.com → Billing carga saldo o sube el límite de gasto. Realtime (voz) consume más que el chat de texto."
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "OpenAI está limitando peticiones (rate limit). Espera 1–2 minutos e inténtalo de nuevo."
  }

  if (
    lower.includes("model") &&
    (lower.includes("not found") ||
      lower.includes("does not exist") ||
      lower.includes("access"))
  ) {
    return "Tu cuenta OpenAI no tiene acceso al modelo Realtime de voz. Revisa el plan o prueba otra API key con Realtime habilitado."
  }

  if (lower.includes("incorrect api key") || lower.includes("invalid_api_key")) {
    return "OPENAI_API_KEY inválida. Revisa la variable en Vercel y regenera la key si hace falta."
  }

  return text || "No se pudo iniciar la voz del informe"
}
