/**
 * MinIO Client for WRI Knowledge Base Papers
 * Connects to: etl-kms/open_alex/gold_papers/
 */

import * as Minio from 'minio'

interface PaperMetadata {
  fileName: string
  fileSize: number
  lastModified: Date
  etag: string
  path: string
}

// Singleton MinIO client
let minioClient: Minio.Client | null = null

/**
 * Initialize MinIO client with WRI credentials
 */
function getMinioClient(): Minio.Client {
  if (minioClient) {
    return minioClient
  }

  const endpoint = process.env.MINIO_ENDPOINT || 'https://s3.wri-indonesia.id'
  const accessKey = process.env.MINIO_ACCESS_KEY || ''
  const secretKey = process.env.MINIO_SECRET_KEY || ''
  const region = process.env.MINIO_REGION || 'ap-southeast-1'

  // Remove https:// from endpoint
  const cleanEndpoint = endpoint.replace(/^https?:\/\//, '')

  console.log(`🪣 Initializing MinIO client for: ${cleanEndpoint}`)

  minioClient = new Minio.Client({
    endPoint: cleanEndpoint,
    accessKey,
    secretKey,
    useSSL: true,
    region,
  })
  
  return minioClient
}

/**
 * List all PDF papers in the gold_papers directory
 */
export async function listPapers(
  bucket: string = 'etl-kms',
  prefix: string = 'open_alex/gold_papers/'
): Promise<PaperMetadata[]> {
  const client = getMinioClient()
  const papers: PaperMetadata[] = []

  return new Promise((resolve, reject) => {
    const stream = client.listObjects(bucket, prefix, true)

    stream.on('data', (obj) => {
      // Only include PDF files
      if (obj.name && obj.name.toLowerCase().endsWith('.pdf')) {
        papers.push({
          fileName: obj.name.split('/').pop() || obj.name,
          fileSize: obj.size || 0,
          lastModified: obj.lastModified || new Date(),
          etag: obj.etag || '',
          path: obj.name,
        })
      }
    })

    stream.on('error', (err) => {
      console.error('Error listing papers from MinIO:', err)
      reject(err)
    })

    stream.on('end', () => {
      console.log(`📚 Found ${papers.length} papers in ${bucket}/${prefix}`)
      resolve(papers)
    })
  })
}

/**
 * Download a specific paper from MinIO
 */
export async function downloadPaper(
  paperPath: string,
  bucket: string = 'etl-kms'
): Promise<Buffer> {
  const client = getMinioClient()

  try {
    const dataStream = await client.getObject(bucket, paperPath)
    const chunks: Buffer[] = []

    return new Promise((resolve, reject) => {
      dataStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      dataStream.on('end', () => {
        const buffer = Buffer.concat(chunks)
        console.log(`✅ Downloaded ${paperPath} (${buffer.length} bytes)`)
        resolve(buffer)
      })

      dataStream.on('error', (streamErr: Error) => {
        console.error(`Stream error for ${paperPath}:`, streamErr)
        reject(streamErr)
      })
    })
  } catch (error) {
    console.error(`Error downloading paper ${paperPath}:`, error)
    throw error
  }
}

/**
 * Get a presigned URL for a paper (for direct access)
 */
export async function getPaperUrl(
  paperPath: string,
  bucket: string = 'etl-kms',
  expirySeconds: number = 3600
): Promise<string> {
  const client = getMinioClient()

  try {
    const url = await client.presignedGetObject(bucket, paperPath, expirySeconds)
    return url
  } catch (error) {
    console.error(`Error generating presigned URL for ${paperPath}:`, error)
    throw error
  }
}

/**
 * Check if a paper exists in MinIO
 */
export async function paperExists(
  paperPath: string,
  bucket: string = 'etl-kms'
): Promise<boolean> {
  const client = getMinioClient()

  try {
    await client.statObject(bucket, paperPath)
    return true
  } catch {
    return false
  }
}

/**
 * Get metadata for a specific paper
 */
export async function getPaperMetadata(
  paperPath: string,
  bucket: string = 'etl-kms'
): Promise<PaperMetadata | null> {
  const client = getMinioClient()

  try {
    const stat = await client.statObject(bucket, paperPath)
    return {
      fileName: paperPath.split('/').pop() || paperPath,
      fileSize: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag,
      path: paperPath,
    }
  } catch (error) {
    console.error(`Error getting metadata for ${paperPath}:`, error)
    return null
  }
}

export default getMinioClient

