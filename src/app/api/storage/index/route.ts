import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import { getMinioClient, initBucket } from '@/lib/minio'
import OpenAI from 'openai'

// Dynamic import for pdf-parse to handle cases where it's not installed
let pdfParse: any = null
try {
  pdfParse = require('pdf-parse')
} catch (error) {
  console.warn('pdf-parse not installed. Please run: npm install pdf-parse')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const BUCKET_NAME = process.env.MINIO_BUCKET || 'documents'
const DEFAULT_PREFIX = process.env.MINIO_STORAGE_PREFIX || ''

// Helper function to check if a file is binary (contains null bytes)
function isBinaryFile(buffer: Buffer): boolean {
  // Check the first 512 bytes for null bytes
  const sampleSize = Math.min(512, buffer.length)
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) {
      return true
    }
  }
  return false
}

// Helper function to clean text and remove null bytes
function cleanText(text: string): string {
  // Remove null bytes and other problematic characters
  return text.replace(/\0/g, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
}

// Helper function to extract text from PDF files
async function extractTextFromPDF(buffer: Buffer): Promise<string | null> {
  if (!pdfParse) {
    throw new Error('pdf-parse is not installed. Please run: npm install pdf-parse')
  }

  try {
    const data = await pdfParse(buffer)
    return data.text
  } catch (error) {
    console.error('Error parsing PDF:', error)
    return null
  }
}

// Helper function to extract text from different file types
async function extractTextFromBuffer(buffer: Buffer, fileName: string): Promise<string | null> {
  const fileExtension = fileName.split('.').pop()?.toLowerCase()

  // Only process PDF files
  if (fileExtension !== 'pdf') {
    console.log(`Skipping non-PDF file: ${fileName}`)
    return null
  }

  // Extract text from PDF
  const text = await extractTextFromPDF(buffer)

  if (!text || text.trim().length === 0) {
    console.log(`No text extracted from PDF: ${fileName}`)
    return null
  }

  // Clean the text to remove any null bytes and problematic characters
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

// Function to generate embedding using OpenAI
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

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const PROJECT_ID = 'DEFAULT'

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

    // Delete all existing MinioDocs for this project
    await prisma.minioDocs.deleteMany({
      where: {
        projectId: PROJECT_ID
      }
    })

    console.log(`Deleted existing MinioDocs for project ${PROJECT_ID}`)

    // Initialize MinIO and get client
    await initBucket(BUCKET_NAME)
    const minioClient = getMinioClient()

    // List all files in MinIO
    const objectsList: any[] = []
    const objectsStream = minioClient.listObjects(BUCKET_NAME, DEFAULT_PREFIX, true)

    for await (const obj of objectsStream) {
      // Skip directories
      if (obj.name?.endsWith('/')) {
        continue
      }
      
      // Only process PDF files
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

    console.log(`Found ${objectsList.length} files in MinIO`)

    const processedFiles: any[] = []
    const totalDocuments: any[] = []

    // Process each file
    for (const fileObj of objectsList) {
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
          console.log(`Skipping file ${fileObj.name}: ${fileText === null ? 'could not extract text' : 'empty'}`)
          continue
        }

        // Split into chunks
        const textChunks = splitIntoChunks(fileText)

        console.log(`Split ${fileObj.name} into ${textChunks.length} chunks`)

        // Process each chunk
        for (let i = 0; i < textChunks.length; i++) {
          let chunk = textChunks[i]
          
          // Ensure chunk doesn't contain null bytes or invalid characters
          chunk = cleanText(chunk)
          
          if (!chunk || chunk.trim().length === 0) {
            console.log(`Skipping empty chunk ${i} from ${fileObj.name}`)
            continue
          }

          // Generate embedding for chunk
          const embedding = await generateEmbedding(chunk)

          // Store in database
          const doc = await prisma.minioDocs.create({
            data: {
              projectId: PROJECT_ID,
              text: chunk,
              embedding
            } as any
          })

          totalDocuments.push({
            id: doc.id,
            fileName: fileObj.name,
            chunkIndex: i,
            text: (doc as any).text.substring(0, 100) + '...',
            hasEmbedding: !!(doc as any).embedding
          })
        }

        processedFiles.push({
          fileName: fileObj.name,
          chunks: textChunks.length
        })

      } catch (error) {
        console.error(`Error processing file ${fileObj.name}:`, error)
        // Continue with next file
      }
    }

    return NextResponse.json({
      success: true,
      projectId: PROJECT_ID,
      totalFiles: processedFiles.length,
      totalDocuments: totalDocuments.length,
      processedFiles,
      documents: totalDocuments
    })

  } catch (error) {
    console.error('Error indexing MinIO documents:', error)
    return NextResponse.json({ 
      error: 'Failed to index MinIO documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

