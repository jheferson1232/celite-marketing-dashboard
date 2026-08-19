import "server-only"

import { getTikTokRequestContext } from "../tiktok-api.server"
import { withTikTokDashboardAccount } from "../tiktok-dashboard-account.server"
import { listTikTokCommentSearchUnitsAllAccounts } from "./fetch-active-ads"
import type { TikTokEnableCommentsResult } from "./types"

const UPDATE_CONCURRENCY = 4

/**
 * Activa comentarios (comment_disabled=false) en adgroups Spark
 * de Calzados_urbanos / Calzados Elite (todas las cuentas).
 */
export async function enableCommentsOnSparkTargetAdgroups(): Promise<TikTokEnableCommentsResult> {
  const { units } = await listTikTokCommentSearchUnitsAllAccounts()

  const failed: TikTokEnableCommentsResult["failed"] = []
  let updated = 0

  const unitsByAccount = new Map<string, typeof units>()
  for (const unit of units) {
    const key = unit.ad.accountId ?? "__current__"
    const list = unitsByAccount.get(key)
    if (list) list.push(unit)
    else unitsByAccount.set(key, [unit])
  }

  for (const [accountId, accountUnits] of unitsByAccount) {
    const updateAccount = async () => {
      const { client, advertiserId } = await getTikTokRequestContext()

      for (let i = 0; i < accountUnits.length; i += UPDATE_CONCURRENCY) {
        const chunk = accountUnits.slice(i, i + UPDATE_CONCURRENCY)
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
    }

    if (accountId === "__current__") {
      await updateAccount()
    } else {
      await withTikTokDashboardAccount(accountId, updateAccount)
    }
  }

  return {
    adgroupsTargeted: units.length,
    updated,
    failed,
  }
}
