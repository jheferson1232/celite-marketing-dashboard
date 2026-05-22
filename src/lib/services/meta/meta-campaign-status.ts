/** Campaña Meta con interruptor ON (nivel campaña). */
export function isMetaCampaignActiveForCount(campaign: {
  status?: string
  effective_status?: string
}): boolean {
  const status = (campaign.status || campaign.effective_status || "").toUpperCase()
  return status === "ACTIVE"
}
