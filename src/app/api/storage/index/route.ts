import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { indexQueue } from '@/lib/queue'
import { getMinioClient, initBucket } from '@/lib/minio'

const BUCKET_NAME = process.env.MINIO_BUCKET || 'documents'
const DEFAULT_PREFIX = process.env.MINIO_STORAGE_PREFIX || ''

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get current user session
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const PROJECT_ID = 'DEFAULT'
    const userId = session.user.id || session.user.email || 'system'

    // Check if FlowProject exists, create if not
    let project = await prisma.flowProject.findUnique({
      where: { id: PROJECT_ID }
    })

    if (!project) {
      project = await prisma.flowProject.create({
        data: {
          id: PROJECT_ID,
          name: 'Default MinIO Documents Project',
          description: 'Auto-created project for MinIO documents indexing'
        }
      })
    }

    // Check if there's already a running job for this project
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
        startedAt: existingJob.startedAt,
      })
    }

    // Count PDF files in MinIO to estimate job size
    await initBucket(BUCKET_NAME)
    const minioClient = getMinioClient()
    
    let pdfCount = 0
    const objectsStream = minioClient.listObjects(BUCKET_NAME, DEFAULT_PREFIX, true)
    
    for await (const obj of objectsStream) {
      if (obj.name?.endsWith('/')) continue
      const fileExtension = obj.name?.split('.').pop()?.toLowerCase()
      if (fileExtension === 'pdf') {
        pdfCount++
      }
    }

    // Create indexing job record
    const job = await prisma.indexingJob.create({
      data: {
        projectId: PROJECT_ID,
        status: 'pending',
        totalFiles: pdfCount,
        startedBy: userId,
      }
    })

    // Add job to queue
    await indexQueue.add(
      'index-pdfs',
      {
        jobId: job.id,
        projectId: PROJECT_ID,
        userId,
      },
      {
        jobId: job.id,
      }
    )

    console.log(`Indexing job ${job.id} queued with ${pdfCount} PDF files`)

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
