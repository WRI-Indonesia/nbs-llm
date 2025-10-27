import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '@/lib/prisma'
import { getMinioClient, initBucket } from '@/lib/minio'
import OpenAI from 'openai'
import type { IndexJobData } from '@/lib/queue'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const BUCKET_NAME = process.env.MINIO_BUCKET || 'documents'
const DEFAULT_PREFIX = process.env.MINIO_STORAGE_PREFIX || ''

// Import pdf-parse
let pdfParse: any = null
try {
  pdfParse = require('pdf-parse')
} catch (error) {
  console.warn('pdf-parse not installed')
}

// Helper function to clean text
function cleanText(text: string): string {
  return text.replace(/\0/g, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
}

// Helper function to extract text from PDF
async function extractTextFromPDF(buffer: Buffer): Promise<string | null> {
  if (!pdfParse) {
    throw new Error('pdf-parse is not installed')
  }

  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch (error) {
    console.error('Error parsing PDF:', error)
    return null
  }
}

// Helper function to extract text from buffer
async function extractTextFromBuffer(buffer: Buffer, fileName: string): Promise<string | null> {
  const fileExtension = fileName.split('.').pop()?.toLowerCase()

  if (fileExtension !== 'pdf') {
    console.log(`Skipping non-PDF file: ${fileName}`)
    return null
  }

  const text = await extractTextFromPDF(buffer)

  if (!text || text.trim().length === 0) {
    console.log(`No text extracted from PDF: ${fileName}`)
    return null
  }

  return cleanText(text)
}

// Function to split text into chunks
function splitIntoChunks(text: string, maxChunkSize: number = 1000): string[] {
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []
  const lines = text.split('\n')
  let currentChunk = ''

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = line
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

// Function to generate embedding
async function generateEmbedding(text: string): Promise<string | null> {
  try {
    const response = await openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING ?? "text-embedding-3-large",
      input: text,
    })

    return JSON.stringify(response.data[0].embedding)
  } catch (error) {
    console.error('Error generating embedding:', error)
    return null
  }
}

// Worker to process indexing jobs
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
})

export const indexWorker = new Worker<IndexJobData>(
  'indexing-jobs',
  async (job: Job<IndexJobData>) => {
    const { jobId, projectId } = job.data

    console.log(`Processing indexing job: ${jobId}`)

    try {
      // Update job status to processing
      await prisma.indexingJob.update({
        where: { id: jobId },
        data: { status: 'processing' },
      })

      // Delete existing MinioDocs for this project
      await prisma.minioDocs.deleteMany({
        where: { projectId },
      })

      console.log(`Deleted existing MinioDocs for project ${projectId}`)

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
          console.log(`Skipping non-PDF file: ${obj.name}`)
          continue
        }

        objectsList.push({
          name: obj.name,
          size: obj.size,
        })
      }

      console.log(`Found ${objectsList.length} PDF files in MinIO`)

      // Update total files count
      await prisma.indexingJob.update({
        where: { id: jobId },
        data: { totalFiles: objectsList.length },
      })

      // Get processed file names
      const jobData = await prisma.indexingJob.findUnique({
        where: { id: jobId },
        select: { processedFileNames: true, processedFiles: true, successfulFiles: true, totalDocuments: true }
      })

      const processedFileNames = (jobData?.processedFileNames as string[]) || []
      let processedFiles = jobData?.processedFiles || 0
      let successfulFiles = jobData?.successfulFiles || 0
      let totalDocuments = jobData?.totalDocuments || 0
      let failedFiles = 0

      // Process each file
      for (const fileObj of objectsList) {
        // Check if job has been cancelled or paused
        const jobCheck = await prisma.indexingJob.findUnique({
          where: { id: jobId },
          select: { status: true }
        })

        if (jobCheck?.status === 'cancelled') {
          console.log(`Job ${jobId} was cancelled, stopping processing`)
          return { success: false, cancelled: true }
        }

        if (jobCheck?.status === 'paused') {
          console.log(`Job ${jobId} was paused, stopping processing`)
          return { success: false, paused: true }
        }

        // Skip already processed files (for resume functionality)
        if (processedFileNames.includes(fileObj.name)) {
          console.log(`Skipping already processed file: ${fileObj.name}`)
          continue
        }

        try {
          console.log(`Processing file: ${fileObj.name}`)

          // Download file from MinIO
          const fileBuffer = await minioClient.getObject(BUCKET_NAME, fileObj.name)

          // Read file buffer
          const chunks: Buffer[] = []
          for await (const chunk of fileBuffer) {
            chunks.push(chunk)
          }
          const buffer = Buffer.concat(chunks)

          // Extract text from PDF file
          const fileText = await extractTextFromBuffer(buffer, fileObj.name)

          if (!fileText || fileText.trim().length === 0) {
            console.log(`Skipping file ${fileObj.name}: could not extract text`)
            continue
          }

          // Split into chunks
          const textChunks = splitIntoChunks(fileText)

          console.log(`Split ${fileObj.name} into ${textChunks.length} chunks`)

          // Process each chunk
          for (let i = 0; i < textChunks.length; i++) {
            let chunk = textChunks[i]

            // Ensure chunk doesn't contain null bytes
            chunk = cleanText(chunk)

            if (!chunk || chunk.trim().length === 0) {
              console.log(`Skipping empty chunk ${i} from ${fileObj.name}`)
              continue
            }

            // Generate embedding for chunk
            const embedding = await generateEmbedding(chunk)

            // Store in database
            await prisma.minioDocs.create({
              data: {
                projectId,
                fileName: fileObj.name,
                text: chunk,
                embedding,
              } as any,
            })

            totalDocuments++
          }

          successfulFiles++
          processedFiles++
          processedFileNames.push(fileObj.name)

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

          console.log(`Completed processing file ${fileObj.name}`)

        } catch (error) {
          console.error(`Error processing file ${fileObj.name}:`, error)
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

      console.log(`Indexing job ${jobId} completed successfully`)
      return { success: true, totalFiles: objectsList.length, totalDocuments }

    } catch (error) {
      console.error(`Error processing indexing job ${jobId}:`, error)

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
  },
  {
    connection: redisConnection,
    concurrency: 1, // Process one job at a time
  }
)

indexWorker.on('completed', (job: Job) => {
  console.log(`Job ${job.id} completed`)
})

indexWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`Job ${job?.id} failed:`, err)
})

console.log('Index worker started')

