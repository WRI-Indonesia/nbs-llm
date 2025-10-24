import { getRedisClient } from './redis'
import crypto from 'crypto'

export async function withCache<T>(
  messages: Array<{ role: string; content: string }>,
  fetcher: () => Promise<T>,
  options: { prefix?: string; ttl?: number } = {}
): Promise<T> {
  const client = await getRedisClient()
  if (!client) return fetcher() // Fallback if Redis unavailable
  
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(messages))
    .digest('hex')
  
  const cacheKey = `${options.prefix || 'llm'}:v1:${hash}`
  
  // Check cache
  const cached = await client.get(cacheKey)
  if (cached) {
    console.log('✅ Cache HIT:', cacheKey.substring(0, 50))
    return JSON.parse(cached)
  }
  
  // Cache miss - call LLM
  console.log('❌ Cache MISS:', cacheKey.substring(0, 50))
  const result = await fetcher()
  
  // Store in cache
  await client.setEx(cacheKey, options.ttl || 86400, JSON.stringify(result))
  
  return result
}