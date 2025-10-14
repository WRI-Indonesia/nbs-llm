import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

// GET /api/schemas/user - List all schemas for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user ID from the token (could be token.sub or token.id)
    const userId = (token as any).id || token.sub
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 })
    }

    // Get user's organizations
    const userOrganizations = await prisma.organizationMembership.findMany({
      where: { userId: userId },
      select: { organizationId: true }
    })

    const ownedOrganizations = await prisma.organization.findMany({
      where: { ownerId: userId },
      select: { id: true }
    })

    const organizationIds = [
      ...userOrganizations.map(m => m.organizationId),
      ...ownedOrganizations.map(o => o.id)
    ]

    // Get all schemas for this user and their organizations
    const schemas = await prisma.schema.findMany({
      where: {
        OR: [
          { userId: userId }, // User's own schemas
          { 
            organizationId: { in: organizationIds },
            visibility: 'INTERNAL'
          } // Organization schemas (only INTERNAL ones)
        ]
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { versions: true }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true
          }
        }
      }
    })

    // Add user role information for each schema
    const schemasWithRoles = await Promise.all(
      schemas.map(async (schema) => {
        let userRole = null
        
        if (schema.organizationId) {
          // Check if user is organization owner
          if (schema.organization?.ownerId === userId) {
            userRole = 'OWNER'
          } else {
            // Check user's role in the organization
            const membership = await prisma.organizationMembership.findFirst({
              where: {
                userId: userId,
                organizationId: schema.organizationId
              },
              select: { role: true }
            })
            userRole = membership?.role || null
          }
        }

        return {
          ...schema,
          userRole
        }
      })
    )

    return NextResponse.json({ schemas: schemasWithRoles })
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
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user ID from the token (could be token.sub or token.id)
    const userId = (token as any).id || token.sub
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, graphJson, visibility = 'PRIVATE', organizationId } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Schema name is required' },
        { status: 400 }
      )
    }

    // Validate organizationId for INTERNAL visibility
    if (visibility === 'INTERNAL' && !organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required for internal schemas' },
        { status: 400 }
      )
    }

    // If organizationId is provided, verify user has access to it
    if (organizationId) {
      const membership = await prisma.organizationMembership.findFirst({
        where: {
          userId: userId,
          organizationId: organizationId
        }
      })

      const isOwner = await prisma.organization.findFirst({
        where: {
          id: organizationId,
          ownerId: userId
        }
      })

      if (!membership && !isOwner) {
        return NextResponse.json(
          { error: 'You do not have access to this organization' },
          { status: 403 }
        )
      }
    }

    // Check if schema with this name already exists for this user
    const existingSchema = await prisma.schema.findFirst({
      where: {
        userId: userId,
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
        userId: userId,
        name,
        description: description || '',
        graphJson: graphJson || { nodes: [], edges: [] },
        visibility: visibility as any,
        organizationId: organizationId || null,
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
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the user ID from the token (could be token.sub or token.id)
    const userId = (token as any).id || token.sub
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const schemaId = searchParams.get('id')

    if (!schemaId) {
      return NextResponse.json({ error: 'Schema ID is required' }, { status: 400 })
    }

    // Get the schema with organization info
    const schema = await prisma.schema.findFirst({
      where: {
        id: schemaId,
        OR: [
          { userId: userId }, // User's own schemas
          { 
            organizationId: { not: null },
            visibility: 'INTERNAL'
          } // Organization schemas
        ]
      },
      include: {
        organization: {
          select: {
            id: true,
            ownerId: true
          }
        }
      }
    })

    if (!schema) {
      return NextResponse.json({ error: 'Schema not found' }, { status: 404 })
    }

    // Check authorization for deletion
    let canDelete = false

    // User can delete their own schemas
    if (schema.userId === userId) {
      canDelete = true
    }

    // For organization schemas, check if user is admin/owner
    if (schema.organizationId && !canDelete) {
      // Check if user is organization owner
      if (schema.organization?.ownerId === userId) {
        canDelete = true
      } else {
        // Check if user has admin role in the organization
        const membership = await prisma.organizationMembership.findFirst({
          where: {
            userId: userId,
            organizationId: schema.organizationId,
            role: { in: ['OWNER', 'ADMIN'] }
          }
        })
        canDelete = !!membership
      }
    }

    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this schema' },
        { status: 403 }
      )
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
