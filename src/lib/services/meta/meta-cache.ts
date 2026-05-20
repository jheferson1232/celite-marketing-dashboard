const cache = new Map<string, { value: unknown; expiresAt: number }>()

export async function withMetaCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T
  }

  const value = await fn()

  if (value !== null && value !== undefined) {
    cache.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  return value
}

export function clearMetaCache(prefix?: string) {
  if (!prefix) {
    cache.clear()
    return
  }

  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}
