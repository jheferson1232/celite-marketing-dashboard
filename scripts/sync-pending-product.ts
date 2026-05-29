import "dotenv/config"
import { syncPendingProductsNow } from "../src/lib/services/product-pending/sync-pending-products"

const keyword = process.argv[2]?.trim() || "Tenis Vans Sb"

syncPendingProductsNow({ keyword })
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2))
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
