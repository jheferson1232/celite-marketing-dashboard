/** Extrae la URL de destino del creativo Meta (varios formatos de anuncio). */
export function extractCreativeDestinationUrl(creative: {
  link_url?: string
  object_url?: string
  object_story_spec?: {
    link_data?: {
      link?: string
      call_to_action?: { value?: { link?: string } }
      child_attachments?: { link?: string }[]
    }
    video_data?: {
      call_to_action?: { value?: { link?: string } }
    }
    template_data?: { link?: string }
  }
  asset_feed_spec?: {
    link_urls?: { website_url?: string }[]
  }
} | null | undefined): string {
  if (!creative) return ""

  const spec = creative.object_story_spec
  const assetFeed = creative.asset_feed_spec

  const candidates: (string | undefined)[] = [
    spec?.link_data?.link,
    spec?.link_data?.call_to_action?.value?.link,
    spec?.video_data?.call_to_action?.value?.link,
    spec?.template_data?.link,
    assetFeed?.link_urls?.[0]?.website_url,
    creative.link_url,
    creative.object_url,
    ...(spec?.link_data?.child_attachments?.map((item) => item.link) ?? []),
  ]

  for (const url of candidates) {
    if (typeof url === "string" && url.trim()) return url.trim()
  }

  return ""
}
