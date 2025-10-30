import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
async function getIndexQueue() {
  const mod = await import('@/lib/queue')
  if (typeof (mod as any).createIndexQueue !== 'function') {
    throw new Error('Queue factory not available')
  }
  return (mod as any).createIndexQueue()
}

export async function POST(request: NextRequest) {
  try {
    // Admin guard
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Support both App Router and plain URL usage
    const searchParams = (request as any).nextUrl?.searchParams ?? new URL(request.url).searchParams
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    // Find job in DB
    const job = await prisma.indexingJob.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Only allow cancelling pending/processing/paused (disallow completed/failed/cancelled)
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      return NextResponse.json({ error: `Cannot cancel job with status '${job.status}'` }, { status: 400 })
    }

    // Try to remove job from queue (if present)
    try {
      const indexQueue = await getIndexQueue()
      const queued = await indexQueue.getJob(jobId)
      if (queued) {
        await queued.remove()
        console.log(`Removed job ${jobId} from queue`)
      } else {
        console.log(`Job ${jobId} not present in queue`)
      }
    } catch (err) {
      // non-fatal: log and continue to update DB
      console.warn(`Error while removing job ${jobId} from queue:`, err)
    }

    // Update DB to cancelled
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    })

    console.log(`Job ${jobId} cancelled (DB updated)`)

    return NextResponse.json({ success: true, message: 'Job cancelled successfully' })
  } catch (error) {
    console.error('Error cancelling job:', error)
    return NextResponse.json({
      error: 'Failed to cancel job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
