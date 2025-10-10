import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/schemas - List all schemas for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Try to find session, but don't require it for non-logged-in users
    let userId = null
    try {
      const session = await prisma.session.findUnique({
        where: { sessionToken: sessionId },
        include: { user: true }
      })

      if (session && session.expires > new Date()) {
        userId = session.userId
      }
    } catch (sessionError) {
      // Session not found or expired, continue with userId = null
      console.log('No valid session found, using sessionId only')
    }

    // Find schemas by sessionId (works for both logged-in and non-logged-in users)
    const schemas = await prisma.schema.findMany({
      where: { 
        sessionId: sessionId,
        ...(userId ? { userId } : {}) // Only filter by userId if we have a valid session
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { versions: true }
        }
      }
    })

    return NextResponse.json({ schemas })
  } catch (error: any) {
    console.error('Error fetching schemas:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schemas', message: error.message },
      { status: 500 }
    )
  }
}

// POST /api/schemas - Create new schema
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, versionId, graphJson } = body

    if (!sessionId || !graphJson) {
      return NextResponse.json(
        { error: 'Session ID and graphJson are required' },
        { status: 400 }
      )
    }

    // Try to find session, but don't require it for non-logged-in users
    let userId = null
    try {
      const session = await prisma.session.findUnique({
        where: { sessionToken: sessionId },
        include: { user: true }
      })

      if (session && session.expires > new Date()) {
        userId = session.userId
      }
    } catch (sessionError) {
      // Session not found or expired, continue with userId = null for guest users
      console.log('No valid session found, creating schema for guest user')
    }

    // Check if a schema already exists for this session
    const existingSchema = await prisma.schema.findFirst({
      where: {
        sessionId,
        name: 'default'
      }
    })

    if (existingSchema) {
      // Update existing schema instead of creating new one
      const newVersion = existingSchema.version + 1
      
      const schema = await prisma.schema.update({
        where: { id: existingSchema.id },
        data: {
          graphJson,
          version: newVersion,
          versions: {
            create: {
              version: newVersion,
              versionId: versionId || `v_${Date.now()}`,
              graphJson,
              restoredFrom: null
            }
          }
        },
        include: {
          versions: true
        }
      })

      return NextResponse.json({ schema, version: newVersion })
    }

    // Create schema with initial version
    const schema = await prisma.schema.create({
      data: {
        userId: userId, // Can be null for non-logged-in users
        sessionId,
        name: 'default',
        description: 'Flow schema design',
        graphJson,
        version: 1,
        versions: {
          create: {
            version: 1,
            versionId: versionId || `v_${Date.now()}`,
            graphJson,
            restoredFrom: null
          }
        }
      },
      include: {
        versions: true
      }
    })

    return NextResponse.json({ schema, version: schema.version }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating schema:', error)
    
    // Handle unique constraint error
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A schema with this name already exists' },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create schema', message: error.message },
      { status: 500 }
    )
  }
}

