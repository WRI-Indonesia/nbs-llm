import { Worker, Job, QueueEvents } from 'bullmq'
import type { IndexJobData } from '@/lib/queue'
import { redisConnectionOptions } from '@/lib/queue'
import { processIndexingJob } from '@/lib/document-processor'

/**
 * A simple worker that pulls `process-indexing` jobs and calls
 * your `processIndexingJob` function. The worker itself keeps
 * minimal responsibilities: call the processing function and log.
 *
 * The processing function is responsible for updating DB job status,
 * checking for pause/cancel, and throwing on fatal errors.
 */

const QUEUE_NAME = 'process-indexing'

export const indexWorker = new Worker<IndexJobData>(
  QUEUE_NAME,
  async (job: Job<IndexJobData>) => {
    const { jobId, projectId } = job.data

    console.log(`🔄 [worker] Starting job ${job.id} (dbId=${jobId})`)

    // Bridge console logs so logs inside processing code are visible and persisted per job
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    }

    const makeForwarder = (level: 'log' | 'info' | 'warn' | 'error') =>
      (...args: unknown[]) => {
        try {
          // Print to worker stdout with a consistent prefix
          originalConsole[level]("[job:" + job.id + "]", ...args)
          // Also persist in BullMQ job logs (best-effort)
          const text = args
            .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
            .join(' ')
          void job.log(`[${level}] ${text}`)
        } catch {
          // Never throw from logging
        }
      }

    console.log = makeForwarder('log') as typeof console.log
    console.info = makeForwarder('info') as typeof console.info
    console.warn = makeForwarder('warn') as typeof console.warn
    console.error = makeForwarder('error') as typeof console.error

    // Provide an optional onProgress callback that updates job progress in DB.
    // If you don't need it, pass undefined.
    const onProgress = async (progressData: any) => {
      console.log(`📈 [worker] Progress for job ${job.id} (dbId=${jobId}):`, progressData)
      // Optional: map to BullMQ progress so you can inspect it via job.progress()
      try {
        await job.updateProgress(progressData)
      } catch (err) {
        console.warn(`[worker] Failed to update job progress for ${job.id}:`, err)
      }
    }

    // Call the core processing function. Let it handle DB status changes.
    try {
      return await processIndexingJob({
        jobId,
        projectId,
        onProgress,
      })
    } finally {
      // Restore original console after job finishes
      console.log = originalConsole.log
      console.info = originalConsole.info
      console.warn = originalConsole.warn
      console.error = originalConsole.error
    }
  },
  {
    // use the same connection settings we exported from queue.ts
    connection: redisConnectionOptions as any,
    concurrency: 1,
  }
)

// Global queue event listeners to observe events even if other workers/processes are involved
const queueEvents = new QueueEvents(QUEUE_NAME, {
  connection: redisConnectionOptions as any,
})

queueEvents.on('added', ({ jobId }) => console.log(`🧾 [events] Job added: ${jobId}`))
queueEvents.on('waiting', ({ jobId }) => console.log(`⏳ [events] Job waiting: ${jobId}`))
queueEvents.on('active', ({ jobId, prev }) => console.log(`🔎 [events] Job active: ${jobId} (prev=${prev})`))
queueEvents.on('progress', ({ jobId, data }) => console.log(`📊 [events] Progress for ${jobId}:`, data))
queueEvents.on('completed', ({ jobId, returnvalue }) => console.log(`✅ [events] Job completed: ${jobId}`, returnvalue))
queueEvents.on('failed', ({ jobId, failedReason }) => console.error(`❌ [events] Job failed: ${jobId} — ${failedReason}`))
queueEvents.on('paused', () => console.log('⏸️  [events] Queue paused'))
queueEvents.on('resumed', () => console.log('▶️  [events] Queue resumed'))
queueEvents.on('drained', () => console.log('🫗 [events] Queue drained'))

indexWorker.on('completed', (job: Job) => {
  console.log(`\n✅ [worker] Job completed successfully!`)
  console.log(`   Queue ID: ${job.id}`)
  console.log(`   DB Job ID: ${(job.data as any)?.jobId}`)
  console.log(`   Project ID: ${(job.data as any)?.projectId}`)
  console.log(`   Completion Time: ${new Date().toISOString()}\n`)
})

indexWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`\n❌ [worker] Job FAILED!`)
  console.error(`   Queue ID: ${job?.id}`)
  console.error(`   DB Job ID: ${(job?.data as any)?.jobId}`)
  console.error(`   Project ID: ${(job?.data as any)?.projectId}`)
  console.error(`   Error: ${err.message}`)
  console.error(`   Stack: ${err.stack}\n`)
})

// Useful lifecycle logs
indexWorker.on('ready', () => {
  console.log('\n✅ Worker is ready and listening for jobs...')
  console.log('📊 You will see real-time progress updates below:\n')
})

indexWorker.on('active', (job: Job) => {
  console.log(`\n🚀 [worker] Starting new job!`)
  console.log(`   Queue ID: ${job.id}`)
  console.log(`   DB Job ID: ${(job.data as any)?.jobId}`)
  console.log(`   Project ID: ${(job.data as any)?.projectId}`)
  console.log(`   Started at: ${new Date().toISOString()}\n`)
})

// Add progress tracking
indexWorker.on('progress', (job: Job, progress: any) => {
  console.log(`📈 Progress update for job ${(job.data as any)?.jobId}:`, progress)
})

// Graceful shutdown for container/signal handling
const shutdown = async (signal: string) => {
  console.log(`[worker] Received ${signal}, shutting down...`)
  try {
    await indexWorker.close(/* force = */ false)
    console.log('[worker] Closed gracefully.')
    process.exit(0)
  } catch (err) {
    console.error('[worker] Error during shutdown:', err)
    process.exit(1)
  }
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

process.on('uncaughtException', (err) => {
  console.error('💥 [worker] Uncaught exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('💥 [worker] Unhandled rejection:', reason)
})

console.log('Index worker started')
console.log(`🔌 Redis: ${redisConnectionOptions.host}:${redisConnectionOptions.port}`)
