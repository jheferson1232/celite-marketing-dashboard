/**
 * Prueba local del informe horario Meta → Telegram (sin HTTP).
 * Uso: pnpm tsx scripts/test-meta-hourly-cron.ts
 *      pnpm tsx scripts/test-meta-hourly-cron.ts --send
 */
import "dotenv/config"
import {
  buildMetaHourlyReportPayload,
  buildMetaHourlyTelegramMessage,
  sendMetaHourlyReportToTelegram,
} from "../src/lib/services/meta/meta-hourly-report"

const shouldSend = process.argv.includes("--send")

async function main() {
  const payload = await buildMetaHourlyReportPayload()
  const message = await buildMetaHourlyTelegramMessage(payload)

  console.log("--- Payload ---")
  console.log({
    hour: payload.hour,
    date: payload.date,
    accountSpend: payload.accountSpend,
    accountPurchases: payload.accountPurchases,
    campaigns: payload.campaigns.length,
    adsetsCriticoActivos: payload.adsetsCriticoActivos.length,
    adsetsToPause: payload.adsetsToPause.length,
    campaignsToPause: payload.campaignsToPause.length,
  })
  if (payload.adsetsCriticoActivos.length > 0) {
    console.log("Critico activos:", payload.adsetsCriticoActivos)
  }

  console.log("\n--- Mensaje Telegram ---\n")
  console.log(message)

  if (shouldSend) {
    const result = await sendMetaHourlyReportToTelegram(payload)
    console.log("\n--- Envío ---")
    console.log({ sent: result.sent })
  } else {
    console.log("\n(Añade --send para enviar a TELEGRAM_ALLOWED_USER_IDS)")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
