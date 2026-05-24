import type { LaunchCheckItem } from "@/lib/services/tiktok/launch-preflight"
import { buildLaunchPreflight } from "@/lib/services/tiktok/launch-preflight"
import { productToLaunchDraft } from "@/lib/services/tiktok/launch-draft"
import type { ProductRecord } from "@/lib/services/product"

export type ProductReadinessResult = {
  ready: boolean
  checks: LaunchCheckItem[]
}

/** Mismas reglas que el preflight de lanzamiento (videos en Blob, sin carpeta local). */
export function evaluateProductReadiness(
  product: ProductRecord
): ProductReadinessResult {
  const preflight = buildLaunchPreflight(productToLaunchDraft(product), "")
  return {
    ready: preflight.ready,
    checks: preflight.checks,
  }
}
