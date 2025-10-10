import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/schemas/user - List all schemas for the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                        request.cookies.get('__Secure-next-auth.session-token')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Find user from session token
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true }
    })

    if (!session || session.expires < new Date()) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Get all schemas for this user
    const schemas = await prisma.schema.findMany({
      where: { userId: session.userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { versions: true }
        }
      }
    })

    return NextResponse.json({ schemas })
  } catch (error: unknown) {
    console.error('Error fetching user schemas:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schemas', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST /api/schemas/user - Create a new schema for the authenticated user
export async function POST(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                        request.cookies.get('__Secure-next-auth.session-token')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Find user from session token
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true }
    })

    if (!session || session.expires < new Date()) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, graphJson } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Schema name is required' },
        { status: 400 }
      )
    }

    // Check if schema with this name already exists for this user
    const existingSchema = await prisma.schema.findFirst({
      where: {
        userId: session.userId,
        name: name
      }
    })

    if (existingSchema) {
      return NextResponse.json(
        { error: 'A schema with this name already exists' },
        { status: 409 }
      )
    }

    // Create new schema
    const schema = await prisma.schema.create({
      data: {
        userId: session.userId,
        name,
        description: description || '',
        graphJson: graphJson || { nodes: [], edges: [] },
        version: 1,
        versions: {
          create: {
            version: 1,
            versionId: `v_${Date.now()}`,
            graphJson: graphJson || { nodes: [], edges: [] },
            restoredFrom: null
          }
        }
      },
      include: {
        versions: true,
        _count: {
          select: { versions: true }
        }
      }
    })

    return NextResponse.json({ schema }, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating schema:', error)
    return NextResponse.json(
      { error: 'Failed to create schema', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE /api/schemas/user/[id] - Delete a schema
export async function DELETE(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                        request.cookies.get('__Secure-next-auth.session-token')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Find user from session token
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true }
    })

    if (!session || session.expires < new Date()) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const schemaId = searchParams.get('id')

    if (!schemaId) {
      return NextResponse.json({ error: 'Schema ID is required' }, { status: 400 })
    }

    // Verify the schema belongs to this user
    const schema = await prisma.schema.findFirst({
      where: {
        id: schemaId,
        userId: session.userId
      }
    })

    if (!schema) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 })
    }

    // Delete the schema (cascade will delete versions)
    await prisma.schema.delete({
      where: { id: schemaId }
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting schema:', error)
    return NextResponse.json(
      { error: 'Failed to delete schema', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
