import { getMetaDashboardAccountId } from "./meta-dashboard-account-store"

const cache = new Map<string, { value: unknown; expiresAt: number }>()

function scopeKey(key: string): string {
  const accountId = getMetaDashboardAccountId()
  return accountId ? `act:${accountId}:${key}` : key
}

export async function withMetaCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const cacheKey = scopeKey(key)
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T
  }

  const value = await fn()

  if (value !== null && value !== undefined) {
    cache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs })
  }

  return value
}

/** Una sola ejecución por clave en esta instancia (p. ej. evitar 2 Telegram si corren :17 y :47). */
export function claimMetaOnce(key: string, ttlMs: number): boolean {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return false
  }
  cache.set(key, { value: true, expiresAt: Date.now() + ttlMs })
  return true
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
