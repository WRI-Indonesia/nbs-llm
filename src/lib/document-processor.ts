import { PDFReader } from '@llamaindex/readers/pdf'
import { OpenAIEmbedding } from '@llamaindex/openai'
import { prisma } from './prisma'
import { getMinioClient, initBucket } from './minio'

const BUCKET_NAME = process.env.MINIO_BUCKET || ''
const DEFAULT_PREFIX = process.env.MINIO_STORAGE_PREFIX || ''

export interface ProcessingProgress {
  processedFiles: number
  successfulFiles: number
  failedFiles: number
  totalDocuments: number
  processedFileNames: string[]
}

export interface ProcessJobOptions {
  jobId: string
  projectId: string
  onProgress?: (progress: ProcessingProgress) => Promise<void>
}

/**
 * Process a single PDF file from MinIO
 */
async function processPDFFile(
  fileName: string,
  projectId: string
): Promise<number> {
  const minioClient = getMinioClient()

  // Download file from MinIO
  const fileBuffer = await minioClient.getObject(BUCKET_NAME, fileName)

  // Read file buffer
  const chunks: Buffer[] = []
  for await (const chunk of fileBuffer) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  // Use LlamaIndex PDFReader to parse the PDF
  const pdfReader = new PDFReader()
  const docs = await pdfReader.loadDataAsContent(buffer)

  let documentCount = 0
  const embeddingModel = new OpenAIEmbedding({
    model: process.env.OPENAI_EMBEDDING ?? "text-embedding-3-large",
  })

  // Process each document from the PDF
  for (const doc of docs) {
    const text = doc.getText().trim()
    if (!text || text.length === 0) {
      continue
    }

    // Extract just the filename from the full path
    const fileNameOnly = fileName.split('/').pop() || fileName

    // Generate embedding using OpenAI
    const embedding = await embeddingModel.getTextEmbedding(text)
    const embeddingJson = JSON.stringify(embedding)

    // Store in database
    await prisma.minioDocs.create({
      data: {
        projectId,
        fileName: fileNameOnly,
        text,
        embedding: embeddingJson,
      },
    })

    documentCount++
  }

  return documentCount
}

/**
 * Update RAGAS evaluation scores for a document
 */
export async function updateRagasScores(
  documentId: number,
  scores: {
    contextPrecision?: number
    contextRecall?: number
    faithfulness?: number
    answerRelevance?: number
    averageScore?: number
  }
): Promise<void> {
  const { contextPrecision, contextRecall, faithfulness, answerRelevance, averageScore } = scores

  await prisma.minioDocs.update({
    where: { id: documentId },
    data: {
      contextPrecision,
      contextRecall,
      faithfulness,
      answerRelevance,
      averageScore,
    },
  })
}

/**
 * Get documents with their RAGAS scores
 */
export async function getDocumentsWithScores(projectId: string) {
  return await prisma.minioDocs.findMany({
    where: { projectId },
    select: {
      id: true,
      fileName: true,
      text: true,
      contextPrecision: true,
      contextRecall: true,
      faithfulness: true,
      answerRelevance: true,
      averageScore: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      averageScore: 'desc',
    },
  })
}

/**
 * Process all PDF files from MinIO for indexing
 */
export async function processIndexingJob(options: ProcessJobOptions): Promise<{
  success: boolean
  totalFiles: number
  totalDocuments: number
  cancelled?: boolean
  paused?: boolean
}> {
  const { jobId, projectId, onProgress } = options

  try {
    // Check if job exists and update job status to processing
    const existingJob = await prisma.indexingJob.findUnique({
      where: { id: jobId },
    })

    if (!existingJob) {
      throw new Error(`Job ${jobId} not found in database`)
    }

    await prisma.indexingJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    })

    console.log(`\n🎯 Starting indexing job...`)
    console.log(`   Job ID: ${jobId}`)
    console.log(`   Project ID: ${projectId}`)
    console.log(`   Status: processing\n`)

    // Delete existing MinioDocs for this project
    await prisma.minioDocs.deleteMany({
      where: { projectId },
    })

    console.log(`🗑️  Deleted existing MinioDocs for project ${projectId}`)

    // Initialize MinIO and get client
    await initBucket(BUCKET_NAME)
    const minioClient = getMinioClient()

    // List all PDF files in MinIO
    const objectsList: any[] = []
    const objectsStream = minioClient.listObjects(BUCKET_NAME, DEFAULT_PREFIX, true)

    for await (const obj of objectsStream) {
      if (obj.name?.endsWith('/')) continue

      const fileExtension = obj.name?.split('.').pop()?.toLowerCase()
      if (fileExtension !== 'pdf') {
        console.log(`⏭️  Skipping non-PDF file: ${obj.name}`)
        continue
      }

      objectsList.push({
        name: obj.name,
        size: obj.size,
      })
    }

    console.log(`\n📁 Found ${objectsList.length} PDF files in MinIO`)
    console.log(`\n${'='.repeat(60)}`)
    console.log(`STARTING INDEXING PROCESS`)
    console.log(`${'='.repeat(60)}\n`)

    // Update total files count
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: { totalFiles: objectsList.length },
    })

    // Get processed file names
    const jobData = await prisma.indexingJob.findUnique({
      where: { id: jobId },
      select: { 
        processedFileNames: true, 
        processedFiles: true, 
        successfulFiles: true, 
        totalDocuments: true 
      }
    })

    const processedFileNames = (jobData?.processedFileNames as string[]) || []
    let processedFiles = jobData?.processedFiles || 0
    let successfulFiles = jobData?.successfulFiles || 0
    let totalDocuments = jobData?.totalDocuments || 0
    let failedFiles = 0
    
    // If resuming a paused job, show that info
    if (processedFiles > 0) {
      console.log(`\n▶️  RESUMING job from paused state...`)
      console.log(`   Already processed: ${processedFiles} files`)
      console.log(`   Documents indexed so far: ${totalDocuments}\n`)
    }

    // Process each file
    for (let i = 0; i < objectsList.length; i++) {
      const fileObj = objectsList[i]
      const fileNumber = i + 1
      
      // Check if job has been cancelled or paused
      const jobCheck = await prisma.indexingJob.findUnique({
        where: { id: jobId },
        select: { status: true }
      })

      if (jobCheck?.status === 'cancelled') {
        console.log(`\n🛑 JOB CANCELLED by user`)
        console.log(`   Job ID: ${jobId}`)
        console.log(`   Processed: ${processedFiles}/${objectsList.length} files`)
        console.log(`   Documents indexed: ${totalDocuments}`)
        console.log(`   Stopped at: ${new Date().toISOString()}\n`)
        return { success: false, cancelled: true, totalFiles: objectsList.length, totalDocuments }
      }

      if (jobCheck?.status === 'paused') {
        console.log(`\n⏸️  JOB PAUSED by user`)
        console.log(`   Job ID: ${jobId}`)
        console.log(`   Processed: ${processedFiles}/${objectsList.length} files`)
        console.log(`   Documents indexed: ${totalDocuments}`)
        console.log(`   Paused at: ${new Date().toISOString()}\n`)
        return { success: false, paused: true, totalFiles: objectsList.length, totalDocuments }
      }

      // Skip already processed files (for resume functionality)
      if (processedFileNames.includes(fileObj.name)) {
        console.log(`⏭️  [${fileNumber}/${objectsList.length}] Skipping already processed: ${fileObj.name}`)
        continue
      }

      try {
        const startTime = Date.now()
        console.log(`\n📄 [${fileNumber}/${objectsList.length}] Processing: ${fileObj.name}`)
        console.log(`   File size: ${(fileObj.size / 1024 / 1024).toFixed(2)} MB`)

        // Process PDF using LlamaIndex
        const docCount = await processPDFFile(fileObj.name, projectId)

        successfulFiles++
        processedFiles++
        processedFileNames.push(fileObj.name)
        totalDocuments += docCount

        const duration = ((Date.now() - startTime) / 1000).toFixed(2)

        // Update progress
        await prisma.indexingJob.update({
          where: { id: jobId },
          data: {
            processedFiles,
            successfulFiles,
            totalDocuments,
            processedFileNames,
          },
        })

        // Call progress callback if provided
        if (onProgress) {
          await onProgress({
            processedFiles,
            successfulFiles,
            failedFiles,
            totalDocuments,
            processedFileNames,
          })
        }

        console.log(`   ✅ Success! Processed ${docCount} documents in ${duration}s`)

      } catch (error) {
        console.error(`\n❌ [${fileNumber}/${objectsList.length}] Failed: ${fileObj.name}`)
        console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
        failedFiles++
        processedFiles++

        // Update progress
        await prisma.indexingJob.update({
          where: { id: jobId },
          data: {
            processedFiles,
            failedFiles,
          },
        })

        // Still call progress callback
        if (onProgress) {
          await onProgress({
            processedFiles,
            successfulFiles,
            failedFiles,
            totalDocuments,
            processedFileNames,
          })
        }
      }
    }

    // Mark job as completed
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        processedFiles,
        successfulFiles,
        failedFiles,
        totalDocuments,
      },
    })

    console.log(`\n${'='.repeat(60)}`)
    console.log(`INDEXING COMPLETE! ✅`)
    console.log(`${'='.repeat(60)}`)
    console.log(`   Job ID: ${jobId}`)
    console.log(`   Total files: ${objectsList.length}`)
    console.log(`   Processed: ${processedFiles}`)
    console.log(`   Successful: ${successfulFiles}`)
    console.log(`   Failed: ${failedFiles}`)
    console.log(`   Total documents indexed: ${totalDocuments}`)
    console.log(`   Completed at: ${new Date().toISOString()}`)
    console.log(`${'='.repeat(60)}\n`)
    
    return { success: true, totalFiles: objectsList.length, totalDocuments }

  } catch (error) {
    console.error(`\n❌ FATAL ERROR processing indexing job ${jobId}:`)
    console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`)
    if (error instanceof Error && error.stack) {
      console.error(`   ${error.stack}`)
    }

    // Mark job as failed
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    })

    throw error
  }
}

