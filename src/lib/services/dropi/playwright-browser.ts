import { existsSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { ServerActionError } from "@/lib/server-action"

const WSL_CHROME_CANDIDATES = [
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
] as const

const LINUX_CHROME_CANDIDATES = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
] as const

function findPuppeteerChromePath(): string | undefined {
  const base = join(homedir(), ".cache/puppeteer-browsers/chrome")
  if (!existsSync(base)) return undefined

  const versions = readdirSync(base).sort().reverse()
  for (const version of versions) {
    const chromePath = join(base, version, "chrome-linux64/chrome")
    if (existsSync(chromePath)) return chromePath
  }

  return undefined
}

export function resolveChromiumExecutablePath(): string | undefined {
  const fromEnv = process.env.PLAYWRIGHT_CHROME_EXECUTABLE?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const puppeteerChrome = findPuppeteerChromePath()
  if (puppeteerChrome) return puppeteerChrome

  for (const path of [...LINUX_CHROME_CANDIDATES, ...WSL_CHROME_CANDIDATES]) {
    if (existsSync(path)) return path
  }

  return undefined
}

export async function launchChromiumBrowser() {
  let chromium: typeof import("playwright").chromium
  try {
    ;({ chromium } = await import("playwright"))
  } catch {
    throw new ServerActionError(
      "Playwright no está instalado. Ejecuta: pnpm add playwright"
    )
  }

  const executablePath = resolveChromiumExecutablePath()

  try {
    return await chromium.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })
  } catch (error) {
    const hint = executablePath
      ? `No se pudo iniciar el navegador en: ${executablePath}`
      : "No hay navegador Chromium. En WSL usa Chrome de Windows o ejecuta: pnpm exec playwright install chromium"

    const detail =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Error desconocido"

    throw new ServerActionError(`${hint}. ${detail}`)
  }
}
