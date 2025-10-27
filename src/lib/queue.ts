import { Queue, QueueOptions } from 'bullmq'
import Redis from 'ioredis'

// Redis connection configuration
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
})

// Queue configuration
export interface IndexJobData {
  jobId: string
  projectId: string
  userId: string
}

export const indexQueue = new Queue<IndexJobData>('indexing-jobs', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
} as QueueOptions)

console.log('Queue initialized')

