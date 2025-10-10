import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/schemas/[id] - Get specific schema
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const schema = await prisma.schema.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 10 // Last 10 versions
        }
      }
    })

    if (!schema) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      )
    }

    // If currentVersion is different from version, load the current version's graph data
    if (schema.currentVersion !== schema.version) {
      const currentVersionData = schema.versions.find((v: any) => v.version === schema.currentVersion)
      if (currentVersionData) {
        // Return schema with current version's graph data
        return NextResponse.json({ 
          schema: {
            ...schema,
            graphJson: currentVersionData.graphJson
          }
        })
      }
    }

    return NextResponse.json({ schema })
  } catch (error: any) {
    console.error('Error fetching schema:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schema', message: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/schemas/[id] - Update schema
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, graphJson, versionId, currentVersion } = body

    // If currentVersion is provided, just update the current version without creating new version
    if (currentVersion !== undefined) {
      const updatedSchema = await prisma.schema.update({
        where: { id },
        data: {
          currentVersion: currentVersion
        },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 10
          }
        }
      })

      return NextResponse.json({ schema: updatedSchema })
    }

    // Get current schema to increment version
    const currentSchema = await prisma.schema.findUnique({
      where: { id },
      select: { version: true }
    })

    if (!currentSchema) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      )
    }

    const newVersion = currentSchema.version + 1

    // Update schema and create new version
    const schema = await prisma.schema.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(graphJson && { graphJson }),
        version: newVersion,
        currentVersion: newVersion, // Update current version to latest
        versions: graphJson ? {
          create: {
            version: newVersion,
            versionId: versionId || `v_${Date.now()}`,
            graphJson,
            restoredFrom: null
          }
        } : undefined
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 10
        }
      }
    })

    return NextResponse.json({ schema, version: newVersion })
  } catch (error: any) {
    console.error('Error updating schema:', error)
    return NextResponse.json(
      { error: 'Failed to update schema', message: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/schemas/[id] - Delete schema
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.schema.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting schema:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete schema', message: error.message },
      { status: 500 }
    )
  }
}

