// queue.ts
import { Queue, QueueOptions } from 'bullmq'

// Shared Redis connection options (used by Queue and Worker)
export const redisConnectionOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  // optional password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
} as const

export interface IndexJobData {
  jobId: string
  projectId: string
  userId?: string
}

const queueOptions: QueueOptions = {
  connection: redisConnectionOptions as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // in seconds
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // in seconds
    },
  },
}

export const indexQueue = new Queue<IndexJobData>('process-indexing', queueOptions)

console.log('Queue initialized')
