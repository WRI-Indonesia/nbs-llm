import { createClient, RedisClientType } from 'redis'

let redisClient: RedisClientType | null = null

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient?.isReady) return redisClient
  
  try {
    redisClient = createClient({ 
      url: process.env.REDIS_URL || 'redis://localhost:6379' 
    })
    await redisClient.connect()
    return redisClient
  } catch (error) {
    console.error('Redis connection failed:', error)
    return null
  }
}