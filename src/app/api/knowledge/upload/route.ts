/**
 * API Endpoint for Dynamic Paper Uploads
 * Allows users to enrich the knowledge base with new papers
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processPaper } from '@/lib/pdf-processor'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const authors = formData.get('authors') as string
    const year = formData.get('year') as string
    const projectId = formData.get('projectId') as string

    if (!file) {
      return NextResponse.json({ error: 'PDF file is required' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    console.log(`📄 Processing uploaded paper: ${file.name}`)

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const pdfBuffer = Buffer.from(arrayBuffer)

    // Process PDF: extract text, chunk, embed
    const { chunks, embeddings, metadata } = await processPaper(pdfBuffer, {
      maxTokensPerChunk: 800,
      minTokensPerChunk: 100,
      overlapTokens: 100,
    })

    console.log(`✅ Processed ${chunks.length} chunks from ${file.name}`)

    // Get or create a project/node for papers
    let project = await prisma.flowProject.findFirst({
      where: { name: 'Knowledge Base Papers' },
    })

    if (!project) {
      project = await prisma.flowProject.create({
        data: {
          name: 'Knowledge Base Papers',
          description: 'User-uploaded peer-reviewed journals',
        },
      })
    }

    // Get or create a node
    const nodeId = `paper-node-upload-${Date.now()}`
    const node = await prisma.flowNode.create({
      data: {
        projectId: project.id,
        nodeId,
        type: 'papers',
        position: { x: 0, y: 0 },
        data: { label: file.name, source: 'upload', uploadedBy: user.id },
      },
    })

    // Store chunks in database
    let storedChunks = 0
    for (const { chunk, embedding } of embeddings) {
      await (prisma.ragDocs.create as any)({
        data: {
          nodeId: node.id,
          text: chunk.text,
          embedding: JSON.stringify(embedding),
          source: 'paper',
          payload: {
            fileName: file.name,
            title: title || file.name.replace('.pdf', ''),
            authors: authors || 'Unknown',
            year: year ? parseInt(year) : undefined,
            chunkIndex: chunk.chunkIndex,
            section: chunk.section,
            tokenCount: chunk.tokenCount,
            uploadedBy: user.id,
            uploadedAt: new Date().toISOString(),
            processedAt: metadata.extractedAt.toISOString(),
          },
        },
      })
      storedChunks++
    }

    console.log(`💾 Stored ${storedChunks} chunks in database`)

    return NextResponse.json({
      success: true,
      message: 'Paper uploaded and indexed successfully',
      fileName: file.name,
      chunks: storedChunks,
      nodeId: node.id,
      projectId: project.id,
    })
  } catch (error) {
    console.error('Error uploading paper:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload and process paper',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// GET endpoint to list all uploaded papers
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get all paper documents grouped by fileName
    const papers = await (prisma.ragDocs.findMany as any)({
      where: {
        source: 'paper',
      },
      distinct: ['payload'],
      select: {
        id: true,
        payload: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Deduplicate and format
    const uniquePapers = new Map()
    
    for (const paper of papers) {
      const payload = paper.payload || {}
      const fileName = payload.fileName
      
      if (fileName && !uniquePapers.has(fileName)) {
        uniquePapers.set(fileName, {
          fileName,
          title: payload.title || fileName,
          authors: payload.authors || 'Unknown',
          year: payload.year,
          uploadedAt: paper.createdAt,
          uploadedBy: payload.uploadedBy,
        })
      }
    }

    return NextResponse.json({
      success: true,
      papers: Array.from(uniquePapers.values()),
      total: uniquePapers.size,
    })
  } catch (error) {
    console.error('Error listing papers:', error)
    return NextResponse.json(
      { error: 'Failed to list papers' },
      { status: 500 }
    )
  }
}

