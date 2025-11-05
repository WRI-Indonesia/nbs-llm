import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// Lazy-create queue at runtime to avoid build-time connections
async function getIndexQueue() {
  const mod = await import('@/lib/queue')
  if (typeof (mod as any).createIndexQueue !== 'function') {
    throw new Error('Queue factory not available')
  }
  return (mod as any).createIndexQueue()
}
import { getMinioClient, initBucket } from '@/lib/minio'

const BUCKET_NAME = process.env.MINIO_BUCKET ?? ''
const DEFAULT_PREFIX = process.env.MINIO_STORAGE_PREFIX ?? ''

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const PROJECT_ID = 'DEFAULT'
    const userId = (session.user as any).id ?? (session.user as any).email ?? 'system'

    // Ensure project exists
    let project = await prisma.flowProject.findUnique({ where: { id: PROJECT_ID } })
    if (!project) {
      project = await prisma.flowProject.create({
        data: {
          id: PROJECT_ID,
          name: 'Default MinIO Documents Project',
          description: 'Auto-created project for MinIO documents indexing'
        }
      })
    }

    // Prevent duplicate running job for this project
    const existingJob = await prisma.indexingJob.findFirst({
      where: {
        projectId: PROJECT_ID,
        status: { in: ['pending', 'processing'] }
      }
    })

    if (existingJob) {
      return NextResponse.json({
        jobId: existingJob.id,
        status: existingJob.status,
        message: 'Indexing job already in progress',
        startedAt: existingJob.startedAt
      })
    }

    // Count PDFs in MinIO
    await initBucket(BUCKET_NAME)
    const minioClient = getMinioClient()
    let pdfCount = 0

    const objectsStream = minioClient.listObjects(BUCKET_NAME, DEFAULT_PREFIX, true)
    for await (const obj of objectsStream) {
      if (!obj || !obj.name) continue
      if (obj.name.endsWith('/')) continue
      const ext = obj.name.split('.').pop()?.toLowerCase()
      if (ext === 'pdf') pdfCount++
    }

    // Create job record
    const job = await prisma.indexingJob.create({
      data: {
        projectId: PROJECT_ID,
        status: 'pending',
        totalFiles: pdfCount,
        startedBy: userId
      }
    })

    // Add to queue with the same jobId (so control endpoints can find it)
    const indexQueue = await getIndexQueue()
    await indexQueue.add(
      'process-indexing',
      {
        jobId: job.id,
        projectId: PROJECT_ID,
        userId,
      },
      {
        jobId: job.id,
      }
    )


    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: 'pending',
      totalFiles: pdfCount,
      message: 'Indexing job queued successfully',
    })
  } catch (error) {
    console.error('Error queuing indexing job:', error)
    return NextResponse.json({
      error: 'Failed to queue indexing job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
