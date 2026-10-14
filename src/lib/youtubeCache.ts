export const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const PREFIX = 'yt-api-cache-v1:'
const memory = new Map<string, { fetchedAt: number; value: unknown }>()
const pending = new Map<string, Promise<unknown>>()

// Storage can be unavailable or full; keep caching in memory in that case.
export async function cachedYouTubeResult<T>(key: string, fetchValue: () => Promise<T>): Promise<T> {
  let entry = memory.get(key)
  if (!entry) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      if (raw) {
        const stored = JSON.parse(raw)
        if (typeof stored?.fetchedAt === 'number' && 'value' in stored) entry = stored
      }
    } catch { /* Ignore unavailable or corrupt storage. */ }
  }
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
    memory.set(key, entry)
    return entry.value as T
  }
  const existing = pending.get(key)
  if (existing) return existing as Promise<T>
  const request = (async () => {
    const value = await fetchValue()
    const fresh = { fetchedAt: Date.now(), value }
    memory.set(key, fresh)
    try { localStorage.setItem(PREFIX + key, JSON.stringify(fresh)) } catch { /* Keep memory cache. */ }
    return value
  })()
  pending.set(key, request)
  try { return await request } finally { pending.delete(key) }
}

export function cacheYouTubeAlias<T>(key: string, value: T): void {
  const entry = { fetchedAt: Date.now(), value }
  memory.set(key, entry)
  try { localStorage.setItem(PREFIX + key, JSON.stringify(entry)) } catch { /* Keep memory cache. */ }
}
