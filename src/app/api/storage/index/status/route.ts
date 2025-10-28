import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const searchParams = (request as any).nextUrl?.searchParams ?? new URL(request.url).searchParams
    const jobId = searchParams.get('jobId')

    if (jobId) {
      const job = await prisma.indexingJob.findUnique({
        where: { id: jobId },
        include: {
          project: {
            select: { id: true, name: true }
          }
        }
      })
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      return NextResponse.json(job)
    }

    // No jobId => return most recent job (if any)
    const latestJob = await prisma.indexingJob.findFirst({
      where: {
        status: { in: ['pending', 'processing', 'paused', 'completed', 'failed', 'cancelled'] }
      },
      orderBy: { startedAt: 'desc' },
      include: {
        project: {
          select: { id: true, name: true }
        }
      }
    })

    if (!latestJob) {
      return NextResponse.json({
        status: 'no-job',
        message: 'No indexing jobs found'
      })
    }

    return NextResponse.json(latestJob)
  } catch (error) {
    console.error('Error getting job status:', error)
    return NextResponse.json({
      error: 'Failed to get job status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
