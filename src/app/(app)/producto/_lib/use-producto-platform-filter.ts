import { parseAsStringEnum, useQueryStates } from "nuqs"
import type { ProductPlatform } from "@/lib/services/product"

export type ProductoPlatformFilter = "all" | ProductPlatform

const PLATFORM_FILTER_VALUES: ProductoPlatformFilter[] = [
  "all",
  "tiktok",
  "meta",
]

/** Filtro de plataforma del producto (URL `pplatform`), por defecto todas. */
export function useProductoPlatformFilter() {
  const [state, setState] = useQueryStates(
    {
      pplatform: parseAsStringEnum<ProductoPlatformFilter>(
        PLATFORM_FILTER_VALUES
      ).withDefault("all"),
    },
    { shallow: false }
  )

  return {
    platformFilter: state.pplatform,
    setPlatformFilter: (platform: ProductoPlatformFilter) =>
      setState({ pplatform: platform }),
  }
}
