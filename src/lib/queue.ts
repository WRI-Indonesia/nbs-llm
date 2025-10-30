// queue.ts
import { Queue, QueueOptions } from 'bullmq'

// Shared Redis connection options (used by Queue and Worker)
export const redisConnectionOptions = {
  host: process.env.REDIS_HOST, // no default to avoid connecting during build
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined,
  // optional password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
} as const

export interface IndexJobData {
  jobId: string
  projectId: string
  userId?: string
}

export function createIndexQueue() {
  if (!redisConnectionOptions.host || !redisConnectionOptions.port) {
    throw new Error('Redis configuration missing (REDIS_HOST/REDIS_PORT)')
  }
  const queueOptions: QueueOptions = {
    connection: {
      host: redisConnectionOptions.host,
      port: redisConnectionOptions.port,
      maxRetriesPerRequest: redisConnectionOptions.maxRetriesPerRequest as any,
    } as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86400 },
    },
  }
  return new Queue<IndexJobData>('process-indexing', queueOptions)
}
