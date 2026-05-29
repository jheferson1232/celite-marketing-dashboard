export type DropiFavoriteRaw = {
  dropiId: string
  name: string
  url?: string | null
  imageUrl?: string | null
  sku?: string | null
  price?: number | null
}

export type DropiScrapeResult = {
  favorites: DropiFavoriteRaw[]
  source: "playwright" | "json_override" | "api"
}
