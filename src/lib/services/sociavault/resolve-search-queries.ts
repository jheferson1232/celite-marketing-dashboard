import { buildSociaVaultSearchQueries } from "./build-search-queries"
import { filterImageKeywords, filterSearchQueries } from "./match-relevance-filter"
import { extractProductImageSearchKeywords } from "./product-image-keywords"
import { getSociaVaultSearchConfig } from "./sociavault-config"

export type ResolveSearchQueriesInput = {
  name: string
  imageUrls?: string[]
}

export type ResolvedSociaVaultQueries = {
  queries: string[]
  imageKeywords: string[]
}

/** Arma las consultas finales respetando límites de créditos y filtros. */
export async function resolveSociaVaultSearchQueries(
  input: ResolveSearchQueriesInput
): Promise<ResolvedSociaVaultQueries> {
  const config = getSociaVaultSearchConfig()
  const name = input.name.trim()
  if (!name && (input.imageUrls?.length ?? 0) === 0) {
    return { queries: [], imageKeywords: [] }
  }

  const imageKeywords = filterImageKeywords(
    await extractProductImageSearchKeywords(input.imageUrls ?? [], {
      productName: name,
      maxQueries: config.maxQueries,
    }),
    name
  )

  const built = buildSociaVaultSearchQueries(
    name,
    imageKeywords,
    config.maxQueries
  )

  const queries = filterSearchQueries(built, name)

  if (queries.length > 0) return { queries, imageKeywords }
  if (name) return { queries: [name], imageKeywords }
  return { queries: imageKeywords.slice(0, 1), imageKeywords }
}

export {
  getSociaVaultSearchConfig,
  estimateSociaVaultCreditsPerSearch,
  describeSociaVaultCreditsPerSearch,
} from "./sociavault-config"
