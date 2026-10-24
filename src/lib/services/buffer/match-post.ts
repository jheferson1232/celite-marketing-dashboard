import knownPosts from "./known-posts.json"

export type KnownBufferPost = {
  videoId: string
  thumbnail: string
  text: string
}

const STORAGE_KEY = "celite-buffer-posts:v1"

export function rememberBufferPosts(
  posts: Array<{
    text: string
    externalLink: string | null
    channelService: string
    assets: Array<{ thumbnail: string }>
  }>
) {
  if (typeof window === "undefined") return

  const slim = posts.flatMap((post) => {
    if (post.channelService !== "tiktok") return []
    const videoId = post.externalLink?.match(/\/video\/(\d{8,})/)?.[1]
    const thumbnail = post.assets.find((asset) => asset.thumbnail)?.thumbnail
    const text = post.text.replace(/\s+/g, " ").trim()
    if (!videoId || !thumbnail || !text) return []
    return [{ videoId, thumbnail, text }]
  })

  if (slim.length === 0) return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
  } catch {
    // Incógnito o cuota llena: queda el snapshot ya guardado.
  }
}

function readRememberedPosts(): KnownBufferPost[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as KnownBufferPost[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((post) => post.videoId && post.thumbnail && post.text)
  } catch {
    return []
  }
}

export function bufferPostsForMatching(): KnownBufferPost[] {
  const remembered = readRememberedPosts()
  return remembered.length > 0 ? remembered : knownPosts
}

export function matchBufferPost(input: {
  itemIds: Array<string | null | undefined>
}): KnownBufferPost | null {
  const posts = bufferPostsForMatching()
  const ids = new Set(
    input.itemIds.flatMap((id) => {
      const trimmed = id?.trim() ?? ""
      if (!trimmed) return []
      const spark = trimmed.startsWith("spark:")
        ? trimmed.slice("spark:".length)
        : trimmed
      return /^\d{8,}$/.test(spark) ? [spark] : []
    })
  )

  if (ids.size === 0) return null
  return posts.find((post) => ids.has(post.videoId)) ?? null
}
