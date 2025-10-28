import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const searchParams = new URL(request.url).searchParams
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Fetch logs for this job
    const logs = await prisma.indexingLog.findMany({
      where: { jobId },
      orderBy: { timestamp: 'asc' },
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching logs:', error)
    return NextResponse.json({
      error: 'Failed to fetch logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

