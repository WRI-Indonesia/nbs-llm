import { PDFReader } from '@llamaindex/readers/pdf'
import { OpenAIEmbedding } from '@llamaindex/openai'
import { prisma } from './prisma'
import { getMinioClient, initBucket } from './minio'
import { createIndexingLogger } from './indexing-logger'

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
  logger?: ReturnType<typeof createIndexingLogger>
}

interface ChunkingConfig {
  chunkSize: number
  overlap: number
}

function chunkText(text: string, { chunkSize, overlap }: ChunkingConfig): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const chunks: string[] = []
  const step = Math.max(1, chunkSize - Math.max(0, overlap))
  for (let start = 0; start < normalized.length; start += step) {
    const end = Math.min(normalized.length, start + chunkSize)
    const slice = normalized.slice(start, end)
    if (slice.length > 0) chunks.push(slice)
    if (end >= normalized.length) break
  }
  return chunks
}

/**
 * Process a single PDF file from MinIO
 */
async function processPDFFile(
  fileName: string,
  projectId: string,
  chunking: ChunkingConfig
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

    const textChunks = chunkText(text, chunking)
    for (const chunk of textChunks) {
      // Generate embedding using OpenAI
      const embedding = await embeddingModel.getTextEmbedding(chunk)
      const embeddingJson = JSON.stringify(embedding)

      await prisma.$queryRawUnsafe(`
      INSERT INTO "minio_docs" ("projectId", "fileName", "text", "embedding")
      VALUES ($1, $2, $3, ($4)::vector(3072))
      `,
        projectId,
        fileNameOnly,
        chunk,
        embeddingJson
      )
      documentCount++

    }
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
  const { jobId, projectId, onProgress, logger } = options

  // Use provided logger or create default one
  const log = logger || createIndexingLogger(jobId)

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

    await log.info(`Starting indexing job`)
    await log.info(`Job ID: ${jobId}`)
    await log.info(`Project ID: ${projectId}`)
    await log.info(`Status: processing`)

    // Load user chunking config
    const userId = existingJob.startedBy
    const userConfig = await (prisma as any).config?.findUnique({ where: { userId } }).catch(() => null)
    const chunking: ChunkingConfig = {
      chunkSize: Math.max(200, Math.min(8000, userConfig?.chunkSize ?? 1000)),
      overlap: Math.max(0, Math.min(4000, userConfig?.overlap ?? 200)),
    }

    // Initialize MinIO and get client
    await initBucket(BUCKET_NAME)
    const minioClient = getMinioClient()

    // List all PDF files in MinIO and extract fileName without path
    const objectsList: any[] = []
    const objectsStream = minioClient.listObjects(BUCKET_NAME, DEFAULT_PREFIX, true)

    for await (const obj of objectsStream) {
      if (obj.name?.endsWith('/')) continue

      const fileExtension = obj.name?.split('.').pop()?.toLowerCase()
      if (fileExtension !== 'pdf') {
        await log.log(`Skipping non-PDF file: ${obj.name}`)
        continue
      }

      // Extract fileName without path (just the filename)
      const fileNameOnly = obj.name.split('/').pop() || obj.name

      objectsList.push({
        name: obj.name, // Full path for MinIO operations
        fileName: fileNameOnly, // Just filename for comparison
        size: obj.size,
      })
    }

    await log.info(`Found ${objectsList.length} PDF files in MinIO`)

    // Get all distinct fileNames that are already indexed in minio_docs for this project
    const indexedFileNamesResult = await prisma.minioDocs.findMany({
      where: { projectId },
      select: { fileName: true },
      distinct: ['fileName']
    })
    const indexedFileNames = new Set(
      indexedFileNamesResult
        .map(doc => doc.fileName)
        .filter((name): name is string => name !== null && name !== '')
    )

    await log.info(`Found ${indexedFileNames.size} already indexed fileNames in database`)

    // Extract fileNames from MinIO (without path)
    const minioFileNames = new Set(objectsList.map(obj => obj.fileName))

    // Find fileNames that are in database but not in MinIO anymore - these should be deleted
    const fileNamesToDelete = Array.from(indexedFileNames).filter(
      fileName => !minioFileNames.has(fileName)
    )

    // Delete minio_docs for fileNames that no longer exist in MinIO
    let deletedCount = 0
    if (fileNamesToDelete.length > 0) {
      const deleteResult = await prisma.minioDocs.deleteMany({
        where: {
          projectId,
          fileName: { in: fileNamesToDelete }
        }
      })
      deletedCount = deleteResult.count
      await log.info(`Deleted ${deletedCount} MinioDocs for ${fileNamesToDelete.length} removed files: ${fileNamesToDelete.join(', ')}`)
    }

    // Filter objectsList to only include files that haven't been indexed yet
    const filesToIndex = objectsList.filter(obj => !indexedFileNames.has(obj.fileName))
    
    await log.info(`Files to index: ${filesToIndex.length} (${objectsList.length - filesToIndex.length} already indexed, ${fileNamesToDelete.length} deleted)`)
    await log.info(`STARTING INDEXING PROCESS`)

    // Update total files count (only count files that need indexing)
    await prisma.indexingJob.update({
      where: { id: jobId },
      data: { totalFiles: filesToIndex.length },
    })

    // Get processed file names (for resume functionality)
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
      await log.info(`RESUMING job from paused state`)
      await log.info(`Already processed: ${processedFiles} files`)
      await log.info(`Documents indexed so far: ${totalDocuments}`)
    }

    // Process each file that needs indexing
    for (let i = 0; i < filesToIndex.length; i++) {
      const fileObj = filesToIndex[i]
      const fileNumber = i + 1

      // Check if job has been cancelled or paused
      const jobCheck = await prisma.indexingJob.findUnique({
        where: { id: jobId },
        select: { status: true }
      })

      if (jobCheck?.status === 'cancelled') {
        await log.warn(`JOB CANCELLED by user`)
        await log.warn(`Processed: ${processedFiles}/${filesToIndex.length} files`)
        await log.warn(`Documents indexed: ${totalDocuments}`)
        await log.warn(`Stopped at: ${new Date().toISOString()}`)
        return { success: false, cancelled: true, totalFiles: filesToIndex.length, totalDocuments }
      }

      if (jobCheck?.status === 'paused') {
        await log.warn(`JOB PAUSED by user`)
        await log.warn(`Processed: ${processedFiles}/${filesToIndex.length} files`)
        await log.warn(`Documents indexed: ${totalDocuments}`)
        await log.warn(`Paused at: ${new Date().toISOString()}`)
        return { success: false, paused: true, totalFiles: filesToIndex.length, totalDocuments }
      }

      // Skip already processed files (for resume functionality)
      if (processedFileNames.includes(fileObj.name)) {
        await log.log(`[${fileNumber}/${filesToIndex.length}] Skipping already processed: ${fileObj.name}`)
        continue
      }

      try {
        const startTime = Date.now()
        await log.info(`[${fileNumber}/${filesToIndex.length}] Processing: ${fileObj.name} (fileName: ${fileObj.fileName})`)
        await log.info(`File size: ${(fileObj.size / 1024 / 1024).toFixed(2)} MB`)

        // Process PDF using LlamaIndex
        const docCount = await processPDFFile(fileObj.name, projectId, chunking)

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

        await log.info(`Success! Processed ${docCount} document chunks in ${duration}s`)

      } catch (error) {
        await log.error(`[${fileNumber}/${filesToIndex.length}] Failed: ${fileObj.name}`)
        await log.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

    await log.info(`INDEXING COMPLETE!`)
    await log.info(`Job ID: ${jobId}`)
    await log.info(`Total files in MinIO: ${objectsList.length}`)
    await log.info(`Files to index: ${filesToIndex.length}`)
    await log.info(`Files already indexed (skipped): ${objectsList.length - filesToIndex.length}`)
    await log.info(`Files deleted (removed from MinIO): ${fileNamesToDelete.length}`)
    await log.info(`Processed: ${processedFiles}`)
    await log.info(`Successful: ${successfulFiles}`)
    await log.info(`Failed: ${failedFiles}`)
    await log.info(`Total documents indexed: ${totalDocuments}`)
    await log.info(`Completed at: ${new Date().toISOString()}`)

    return { success: true, totalFiles: filesToIndex.length, totalDocuments }

  } catch (error) {
    await log.error(`FATAL ERROR processing indexing job ${jobId}`)
    await log.error(`${error instanceof Error ? error.message : 'Unknown error'}`)
    if (error instanceof Error && error.stack) {
      await log.error(`${error.stack}`)
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

