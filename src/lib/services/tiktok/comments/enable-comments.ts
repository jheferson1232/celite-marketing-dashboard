import "server-only"

import { getTikTokRequestContext } from "../tiktok-api.server"
import { listTikTokCommentSearchUnits } from "./fetch-active-ads"
import type { TikTokEnableCommentsResult } from "./types"

const UPDATE_CONCURRENCY = 4

/**
 * Activa comentarios (comment_disabled=false) en adgroups Spark
 * de Calzados_urbanos / Calzados Elite.
 */
export async function enableCommentsOnSparkTargetAdgroups(): Promise<TikTokEnableCommentsResult> {
  const { client, advertiserId } = await getTikTokRequestContext()
  const { units } = await listTikTokCommentSearchUnits()

  const failed: TikTokEnableCommentsResult["failed"] = []
  let updated = 0

  for (let i = 0; i < units.length; i += UPDATE_CONCURRENCY) {
    const chunk = units.slice(i, i + UPDATE_CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map(async (unit) => {
        await client.post("/adgroup/update/", {
          advertiser_id: advertiserId,
          adgroup_id: unit.adgroupId,
          comment_disabled: false,
        })
        return unit.adgroupId
      })
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]!
      const unit = chunk[j]!
      if (result.status === "fulfilled") {
        updated += 1
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : "Error al actualizar adgroup"
        failed.push({ adgroupId: unit.adgroupId, error: message })
      }
    }
  }

  return {
    adgroupsTargeted: units.length,
    updated,
    failed,
  }
}
