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

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    // Find the job
    const job = await prisma.indexingJob.findUnique({
      where: { id: jobId }
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Only allow cancelling pending or processing jobs
    if (job.status === 'completed') {
      return NextResponse.json({ error: 'Cannot cancel completed job' }, { status: 400 })
    }

    if (job.status === 'failed') {
      return NextResponse.json({ error: 'Cannot cancel failed job' }, { status: 400 })
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

  } catch (error) {
    console.error('Error cancelling job:', error)
    return NextResponse.json({ 
      error: 'Failed to cancel job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

