// MinIO configuration - dynamically imported to avoid build issues
let minioClient: any = null

async function getMinioClient() {
  if (!minioClient) {
    try {
      const { Client } = await import('minio')
      minioClient = new Client({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
      })
    } catch (error) {
      console.warn('MinIO package not installed. Image uploads will be disabled.')
      return null
    }
  }
  return minioClient
}

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'blog-images'

// Ensure bucket exists
export async function ensureBucketExists() {
  const client = await getMinioClient()
  if (!client) return false
  
  try {
    const exists = await client.bucketExists(BUCKET_NAME)
    if (!exists) {
      await client.makeBucket(BUCKET_NAME, 'us-east-1')
      console.log(`Created bucket: ${BUCKET_NAME}`)
    }
    return true
  } catch (error) {
    console.error('Error ensuring bucket exists:', error)
    return false
  }
}

// Upload image to MinIO
export async function uploadImageToMinIO(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const client = await getMinioClient()
  if (!client) {
    throw new Error('MinIO not available')
  }

  try {
    await ensureBucketExists()
    
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const objectName = `blog-images/${timestamp}-${sanitizedFileName}`
    
    await client.putObject(BUCKET_NAME, objectName, file, {
      'Content-Type': contentType,
    })
    
    // Return the public URL
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'
    const port = process.env.MINIO_PORT ? `:${process.env.MINIO_PORT}` : ''
    const baseUrl = `${protocol}://${process.env.MINIO_ENDPOINT}${port}`
    
    return `${baseUrl}/${BUCKET_NAME}/${objectName}`
  } catch (error) {
    console.error('Error uploading to MinIO:', error)
    throw new Error('Failed to upload image')
  }
}

// Delete image from MinIO
export async function deleteImageFromMinIO(imageUrl: string): Promise<void> {
  const client = await getMinioClient()
  if (!client) {
    throw new Error('MinIO not available')
  }

  try {
    const url = new URL(imageUrl)
    const objectName = url.pathname.substring(1) // Remove leading slash
    
    await client.removeObject(BUCKET_NAME, objectName)
  } catch (error) {
    console.error('Error deleting from MinIO:', error)
    throw new Error('Failed to delete image')
  }
}

// Get presigned URL for direct uploads (optional)
export async function getPresignedUploadUrl(
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = await getMinioClient()
  if (!client) {
    throw new Error('MinIO not available')
  }

  try {
    await ensureBucketExists()
    
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const objectName = `blog-images/${timestamp}-${sanitizedFileName}`
    
    const uploadUrl = await client.presignedPutObject(
      BUCKET_NAME,
      objectName,
      24 * 60 * 60 // 24 hours
    )
    
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'
    const port = process.env.MINIO_PORT ? `:${process.env.MINIO_PORT}` : ''
    const baseUrl = `${protocol}://${process.env.MINIO_ENDPOINT}${port}`
    const publicUrl = `${baseUrl}/${BUCKET_NAME}/${objectName}`
    
    return { uploadUrl, publicUrl }
  } catch (error) {
    console.error('Error getting presigned URL:', error)
    throw new Error('Failed to get upload URL')
  }
}

export default getMinioClient