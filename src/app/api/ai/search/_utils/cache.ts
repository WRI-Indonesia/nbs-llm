import Redis from 'ioredis'
import crypto from 'crypto'

const CACHE_ENABLED = (process.env.CACHE_ENABLED ?? 'false').toLowerCase() === 'true'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (!CACHE_ENABLED) return null
  if (redis) return redis
  try {
    redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      // password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null as any,
      lazyConnect: true,
    })
    // best-effort connect; swallow errors and operate as no-op cache
    redis.connect().catch(() => {})
    return redis
  } catch {
    return null
  }
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  const client = getRedis()
  if (!client) return null
  try {
    const val = await client.get(key)
    return val ? (JSON.parse(val) as T) : null
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  const client = getRedis()
  if (!client) return
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch {
    // ignore
  }
}

export async function cacheGetOrSet<T>(key: string, ttlSeconds: number, producer: () => Promise<T>): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached
  const val = await producer()
  await cacheSet(key, val, ttlSeconds)
  return val
}


