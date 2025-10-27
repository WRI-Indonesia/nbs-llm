import { NextRequest, NextResponse } from 'next/server'
import { getMinioClient, initBucket } from '@/lib/minio'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BUCKET_NAME = process.env.MINIO_BUCKET || 'documents'
const DEFAULT_PREFIX = process.env.MINIO_STORAGE_PREFIX || ''

// GET - List files in bucket
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryPrefix = searchParams.get('prefix') || ''
    const prefix = queryPrefix || DEFAULT_PREFIX

    await initBucket(BUCKET_NAME)
    const minioClient = getMinioClient()

    const objectsList: any[] = []
    const objectsStream = minioClient.listObjects(BUCKET_NAME, prefix, true)

    for await (const obj of objectsStream) {
      objectsList.push({
        name: obj.name,
        size: obj.size,
        lastModified: obj.lastModified?.toISOString(),
        etag: obj.etag,
      })
    }

    return NextResponse.json({ files: objectsList })
  } catch (error: any) {
    console.error('Error listing files:', error)
    return NextResponse.json({ error: error.message || 'Failed to list files' }, { status: 500 })
  }
}

// POST - Upload file
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const path = formData.get('path') as string || ''

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    await initBucket(BUCKET_NAME)
    const minioClient = getMinioClient()

    // Use custom path or prepend default prefix to filename
    const fileName = path || (DEFAULT_PREFIX ? `${DEFAULT_PREFIX}${file.name}` : file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    
    await minioClient.putObject(
      BUCKET_NAME,
      fileName,
      buffer,
      buffer.length,
      {
        'Content-Type': file.type || 'application/octet-stream',
      }
    )

    return NextResponse.json({ 
      message: 'File uploaded successfully',
      fileName,
      size: buffer.length
    })
  } catch (error: any) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: error.message || 'Failed to upload file' }, { status: 500 })
  }
}

// DELETE - Delete file
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('fileName')

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 })
    }

    await initBucket(BUCKET_NAME)
    const minioClient = getMinioClient()

    await minioClient.removeObject(BUCKET_NAME, fileName)

    return NextResponse.json({ message: 'File deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting file:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete file' }, { status: 500 })
  }
}

