import "dotenv/config"
import axios from "axios"

async function main() {
  const key = process.env.SOCIAVAULT_API_KEY
  const paths = [
    {
      path: "/v1/scrape/google/search",
      params: { query: "site:instagram.com/reel tenis vans" },
    },
    {
      path: "/v1/scrape/tiktok/search/keyword",
      params: { query: "tenis vans", sort_by: "relevance", date_posted: "all-time" },
    },
  ]
  for (const { path, params } of paths) {
    const res = await axios.get(`https://api.sociavault.com${path}`, {
      params,
      headers: { "X-API-Key": key },
      validateStatus: () => true,
    })
    console.log(path, res.status, JSON.stringify(res.data).slice(0, 200))
  }
}

main().catch(console.error)
