import * as Minio from 'minio'

// Initialize MinIO client
export const getMinioClient = () => {
  // Parse endpoint to extract hostname and port
  let endpoint = process.env.MINIO_ENDPOINT || 'localhost:9000'
  let useSSL = false
  let port = 443 // Default for HTTPS
  
  // Check if using SSL
  if (endpoint.startsWith('https://')) {
    useSSL = true
    port = 443
    // Remove protocol
    endpoint = endpoint.replace(/^https:\/\//, '')
  } else if (endpoint.startsWith('http://')) {
    useSSL = false
    port = 80
    // Remove protocol
    endpoint = endpoint.replace(/^http:\/\//, '')
  } else {
    // No protocol specified, check if port is included
    const parts = endpoint.split(':')
    if (parts.length > 1) {
      port = parseInt(parts[1])
    }
  }
  
  // Split by ':' to get hostname and any remaining port info
  const parts = endpoint.split(':')
  const hostname = parts[0]
  
  // Override port if specified in the endpoint after removing protocol
  if (parts.length > 1 && !isNaN(parseInt(parts[1]))) {
    port = parseInt(parts[1])
  }
  
  return new Minio.Client({
    endPoint: hostname,
    port: port,
    useSSL: useSSL,
    region: process.env.MINIO_REGION || 'us-east-1',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  })
}

// Initialize bucket if it doesn't exist
export const initBucket = async (bucketName: string) => {
  const minioClient = getMinioClient()
  const exists = await minioClient.bucketExists(bucketName)
  
  const region = process.env.MINIO_REGION || 'us-east-1'
  
  if (!exists) {
    await minioClient.makeBucket(bucketName, region)
    console.log(`Bucket ${bucketName} created successfully in region ${region}`)
  }
  
  return minioClient
}

