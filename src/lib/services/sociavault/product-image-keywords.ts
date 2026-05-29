import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import { getSociaVaultSearchConfig } from "./sociavault-config"
import { normalizeSearchPhrase } from "./sociavault-parse-utils"

function keywordsFromImageUrl(url: string): string[] {
  try {
    const pathname = new URL(url).pathname
    const base = pathname.split("/").pop()?.split("?")[0] ?? ""
    const decoded = decodeURIComponent(base)
    const tokens = decoded
      .replace(/\.[a-z0-9]+$/i, "")
      .split(/[-_\s.]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !/^\d+$/.test(t))
    return tokens.slice(0, 3)
  } catch {
    return []
  }
}

/** Una sola frase óptima para SociaVault (modo ahorro de créditos). */
export async function visionSingleSearchPhrase(
  imageUrl: string,
  productName: string
): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY?.trim()) return null
  if (!getSociaVaultSearchConfig().imageVision) return null

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: imageUrl },
            {
              type: "text",
              text:
                `Producto en catálogo: "${productName}". ` +
                "Responde SOLO con UNA frase corta en español para buscar videos similares en TikTok " +
                "(tipo de producto exacto en la foto). Sin comas ni explicación. " +
                "NO uses categorías incorrectas (ej. purificador de aire si es clip nasal).",
            },
          ],
        },
      ],
    })

    const raw = text.trim().split("\n")[0]?.trim()
    const phrase = raw ? normalizeSearchPhrase(raw) : ""
    return phrase.length > 2 ? phrase : null
  } catch (error) {
    console.error("SociaVault vision (single phrase):", error)
    return null
  }
}

async function visionKeywordsFromImage(
  imageUrl: string,
  maxPhrases: number
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY?.trim()) return []
  if (!getSociaVaultSearchConfig().imageVision) return []

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: imageUrl },
            {
              type: "text",
              text:
                "Este producto se buscará en videos de TikTok. " +
                `Responde SOLO con hasta ${maxPhrases} frases cortas de búsqueda en español separadas por coma ` +
                "(tipo de producto EXACTO que ves en la foto). " +
                "NO inventes otros productos. Sin explicación.",
            },
          ],
        },
      ],
    })

    return text
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 2)
      .slice(0, maxPhrases)
  } catch (error) {
    console.error("SociaVault image vision:", error)
    return []
  }
}

export type ImageKeywordsOptions = {
  productName: string
  maxQueries: number
}

/**
 * Palabras clave desde imagen. En modo ahorro (maxQueries=1) devuelve como máximo 1 frase vía OpenAI.
 */
export async function extractProductImageSearchKeywords(
  imageUrls: string[],
  options: ImageKeywordsOptions
): Promise<string[]> {
  const urls = imageUrls.filter((u) => typeof u === "string" && u.trim()).slice(0, 1)
  if (urls.length === 0) return []

  const economy = options.maxQueries <= 1

  if (economy && getSociaVaultSearchConfig().imageVision) {
    const phrase = await visionSingleSearchPhrase(urls[0]!, options.productName)
    return phrase ? [phrase] : []
  }

  const seen = new Set<string>()
  const keywords: string[] = []

  const add = (value: string) => {
    const v = value.trim()
    if (v.length < 2) return
    const key = v.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    keywords.push(v)
  }

  if (!economy) {
    for (const url of urls) {
      for (const token of keywordsFromImageUrl(url)) add(token)
    }
    const vision = await visionKeywordsFromImage(urls[0]!, 4)
    for (const phrase of vision) add(phrase)
  }

  return keywords.slice(0, Math.max(1, options.maxQueries - 1))
}
