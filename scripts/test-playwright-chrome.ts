import { launchChromiumBrowser } from "../src/lib/services/dropi/playwright-browser"

async function main() {
  const browser = await launchChromiumBrowser()
  try {
    const page = await browser.newPage()
    await page.goto("https://example.com", { timeout: 30_000 })
    console.log("OK:", await page.title())
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
