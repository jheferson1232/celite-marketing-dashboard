export function extractVideoIdFromCreative(creative: {
  video_id?: string
  object_story_spec?: {
    video_data?: { video_id?: string }
  }
  asset_feed_spec?: {
    videos?: Array<{ video_id?: string }>
  }
} | null | undefined): string {
  if (!creative) return ""

  const fromStory = creative.object_story_spec?.video_data?.video_id
  const fromFeed = creative.asset_feed_spec?.videos?.find((v) => v.video_id)
    ?.video_id

  return fromStory || fromFeed || creative.video_id || ""
}
