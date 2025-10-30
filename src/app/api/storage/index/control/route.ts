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
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const searchParams = (request as any).nextUrl?.searchParams ?? new URL(request.url).searchParams
    const jobId = searchParams.get('jobId')
    const action = searchParams.get('action') // 'pause' | 'resume' | 'cancel'

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }
    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use pause, resume, or cancel' }, { status: 400 })
    }

    const job = await prisma.indexingJob.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Pause: mark DB as paused (workers should check DB before processing items)
    if (action === 'pause') {
      if (job.status !== 'processing') {
        return NextResponse.json({ error: 'Can only pause jobs with status "processing"' }, { status: 400 })
      }

      await prisma.indexingJob.update({
        where: { id: jobId },
        data: { status: 'paused' }
      })

      console.log(`Job ${jobId} paused (DB updated)`)
      return NextResponse.json({ success: true, status: 'paused', message: 'Job paused successfully' })
    }

    // Resume: update DB and re-queue the job if not present
    if (action === 'resume') {
      if (job.status !== 'paused') {
        return NextResponse.json({ error: 'Can only resume jobs with status "paused"' }, { status: 400 })
      }

      // update DB to processing
      await prisma.indexingJob.update({
        where: { id: jobId },
        data: { status: 'processing' }
      })

      // Attempt to remove any leftover job with the same ID then re-add.
      // Use the same jobId so later cancels/resumes match easily.
      try {
        const indexQueue = await getIndexQueue()
        const existing = await indexQueue.getJob(jobId)
        if (existing) {
          try {
            const state = await existing.getState()
            // Only remove if it's safe (not active/locked)
            if (['waiting', 'delayed', 'paused', 'waiting-children'].includes(state)) {
              await existing.remove()
              console.log(`Removed existing queued job ${jobId} (state=${state}) before re-queue`)
            } else {
              console.log(`Skip removal for job ${jobId} because state=${state} (likely active)`)
            }
          } catch (stateErr) {
            console.warn(`Could not determine state for job ${jobId} prior to re-queue:`, stateErr)
          }
        }
      } catch (err) {
        console.warn(`Error while cleaning up existing queued job ${jobId}:`, err)
      }

      try {
        const indexQueue = await getIndexQueue()
        await indexQueue.add(
          'process-indexing',
          {
            jobId: jobId,
            projectId: job.projectId,
            userId: job.startedBy,
          },
          {
            jobId: jobId, // reuse same ID so it can be referenced/removed later
          }
        )
        console.log(`Job ${jobId} re-queued for processing`)
      } catch (err) {
        console.error(`Failed to re-queue job ${jobId}:`, err)
        // revert status so admin can retry
        await prisma.indexingJob.update({
          where: { id: jobId },
          data: { status: 'paused' }
        })
        return NextResponse.json({ error: 'Failed to re-queue job', details: (err as Error).message }, { status: 500 })
      }

      return NextResponse.json({ success: true, status: 'processing', message: 'Job resumed and re-queued successfully' })
    }

    // Cancel: same semantics as CANCEL handler but allow paused/pending/processing
    if (action === 'cancel') {
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        return NextResponse.json({ error: `Cannot cancel job with status '${job.status}'` }, { status: 400 })
      }

      try {
        const indexQueue = await getIndexQueue()
        const queued = await indexQueue.getJob(jobId)
        if (queued) {
          try {
            const state = await queued.getState()
            if (['waiting', 'delayed', 'paused', 'waiting-children'].includes(state)) {
              await queued.remove()
              console.log(`Removed job ${jobId} from queue (state=${state})`)
            } else {
              console.log(`Job ${jobId} is ${state} (likely active/locked); marking as cancelled in DB and letting worker stop.`)
            }
          } catch (stateErr) {
            console.warn(`Could not determine job state for ${jobId} during cancel:`, stateErr)
          }
        } else {
          console.log(`Job ${jobId} not found in queue (maybe already processed)`)
        }
      } catch (err) {
        console.warn(`Error while removing job ${jobId} from queue:`, err)
      }

      await prisma.indexingJob.update({
        where: { id: jobId },
        data: { status: 'cancelled', completedAt: new Date() }
      })

      console.log(`Job ${jobId} cancelled (DB updated)`)
      return NextResponse.json({ success: true, message: 'Job cancelled successfully' })
    }

    // Should never get here
    return NextResponse.json({ error: 'Unhandled action' }, { status: 400 })
  } catch (error) {
    console.error('Error controlling job:', error)
    return NextResponse.json({
      error: 'Failed to control job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
