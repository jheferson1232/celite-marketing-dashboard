/**
 * Interruptor del conjunto (como TikTok): cuenta activo si el conjunto está ON,
 * aunque la campaña esté pausada (effective CAMPAIGN_PAUSED + status ACTIVE).
 */
export function isMetaAdSetActiveForCount(adset: {
  status?: string
  effective_status?: string
}): boolean {
  const status = (adset.status || "").toUpperCase()
  const effective = (adset.effective_status || "").toUpperCase()

  if (
    status === "DELETED" ||
    status === "ARCHIVED" ||
    effective === "DELETED" ||
    effective === "ARCHIVED"
  ) {
    return false
  }

  if (effective === "ADSET_PAUSED") return false

  if (effective === "CAMPAIGN_PAUSED") {
    return status === "ACTIVE"
  }

  if (status === "PAUSED" || effective === "PAUSED") {
    return false
  }

  return status === "ACTIVE" || effective === "ACTIVE"
}
