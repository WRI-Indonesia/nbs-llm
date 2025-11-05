import { prisma } from './prisma'

export type LogLevel = 'log' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp?: Date
}

/**
 * Add a log entry to the IndexingLog table
 */
export async function addIndexingLog(
  jobId: string,
  level: LogLevel,
  message: string
): Promise<void> {
  try {
    await prisma.indexingLog.create({
      data: {
        jobId,
        level,
        message,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    // Don't throw - logging should never fail the main process
    console.error(`Failed to add indexing log: ${error}`)
  }
}

/**
 * Create a logger that stores logs in the database
 */
export function createIndexingLogger(jobId: string) {
  return {
    log: async (message: string) => {
      await addIndexingLog(jobId, 'log', message)
    },
    info: async (message: string) => {
      console.info(`[job:${jobId}]`, message)
      await addIndexingLog(jobId, 'info', message)
    },
    warn: async (message: string) => {
      console.warn(`[job:${jobId}]`, message)
      await addIndexingLog(jobId, 'warn', message)
    },
    error: async (message: string) => {
      console.error(`[job:${jobId}]`, message)
      await addIndexingLog(jobId, 'error', message)
    },
  }
}

