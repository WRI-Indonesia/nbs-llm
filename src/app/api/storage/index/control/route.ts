import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import { indexQueue } from '@/lib/queue'

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const action = searchParams.get('action') // 'pause', 'resume', 'cancel'

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use pause, resume, or cancel' }, { status: 400 })
    }

    // Find the job
    const job = await prisma.indexingJob.findUnique({
      where: { id: jobId }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Handle different actions
    if (action === 'pause') {
      // Only allow pausing processing jobs
      if (job.status !== 'processing') {
        return NextResponse.json({ error: 'Can only pause processing jobs' }, { status: 400 })
      }

      await prisma.indexingJob.update({
        where: { id: jobId },
        data: { status: 'paused' }
      })

      console.log(`Job ${jobId} paused`)

      return NextResponse.json({
        success: true,
        status: 'paused',
        message: 'Job paused successfully'
      })
    }

    if (action === 'resume') {
      // Only allow resuming paused jobs
      if (job.status !== 'paused') {
        return NextResponse.json({ error: 'Can only resume paused jobs' }, { status: 400 })
      }

      // Update status to processing
      await prisma.indexingJob.update({
        where: { id: jobId },
        data: { status: 'processing' }
      })

      // Try to remove any existing job from the queue (in case it's stuck)
      try {
        const existingJob = await indexQueue.getJob(jobId)
        if (existingJob) {
          await existingJob.remove()
          console.log(`Removed existing job ${jobId} from queue`)
        }
      } catch (error) {
        console.log(`No existing job ${jobId} in queue (this is ok)`)
      }

      // Re-add job to queue with a unique ID to avoid conflicts
      await indexQueue.add(
        'index-pdfs',
        {
          jobId: jobId,
          projectId: job.projectId,
          userId: job.startedBy,
        },
        {
          jobId: `${jobId}-resume-${Date.now()}` // Unique ID for resume
        }
      )

      console.log(`Job ${jobId} resumed and re-queued with new ID`)

      return NextResponse.json({
        success: true,
        status: 'processing',
        message: 'Job resumed successfully'
      })
    }

    if (action === 'cancel') {
      // Only allow cancelling pending, processing, or paused jobs
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        return NextResponse.json({ error: 'Cannot cancel completed, failed, or cancelled job' }, { status: 400 })
      }

      // Cancel the job in the queue
      try {
        const jobToCancel = await indexQueue.getJob(jobId)
        if (jobToCancel) {
          await jobToCancel.remove()
        }
      } catch (error) {
        console.log('Job not found in queue (may have already completed)')
      }

      // Update job status to cancelled
      await prisma.indexingJob.update({
        where: { id: jobId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
        }
      })

      console.log(`Job ${jobId} cancelled`)

      return NextResponse.json({
        success: true,
        message: 'Job cancelled successfully'
      })
    }

  } catch (error) {
    console.error('Error controlling job:', error)
    return NextResponse.json({ 
      error: 'Failed to control job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

