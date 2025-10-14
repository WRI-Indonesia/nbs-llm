import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

// GET /api/schemas/[id]/access - Get schema access list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.sub) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Check if user owns the schema or has access to it
    const schema = await prisma.schema.findUnique({
      where: { id },
      include: {
        user: true,
        organization: true,
        schemaAccess: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        }
      }
    })

    if (!schema) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      )
    }

    // Check permissions
    const isOwner = schema.userId === token.sub
    const isOrgMember = schema.organizationId && await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: token.sub,
          organizationId: schema.organizationId
        }
      }
    })

    if (!isOwner && !isOrgMember && schema.visibility !== 'PUBLIC') {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      schema: {
        id: schema.id,
        name: schema.name,
        visibility: schema.visibility,
        user: schema.user,
        organization: schema.organization
      },
      access: schema.schemaAccess.map(access => ({
        id: access.id,
        userId: access.userId,
        createdAt: access.createdAt,
        user: access.user
      }))
    })
  } catch (error) {
    console.error('Error fetching schema access:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/schemas/[id]/access - Grant access to schema
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.sub) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if user owns the schema
    const schema = await prisma.schema.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!schema) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      )
    }

    if (schema.userId !== token.sub) {
      return NextResponse.json(
        { error: 'Only the schema owner can grant access' },
        { status: 403 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if access already exists
    const existingAccess = await prisma.schemaAccess.findUnique({
      where: {
        userId_schemaId: {
          userId: userId,
          schemaId: id
        }
      }
    })

    if (existingAccess) {
      return NextResponse.json(
        { error: 'User already has access to this schema' },
        { status: 400 }
      )
    }

    // Grant access
    const access = await prisma.schemaAccess.create({
      data: {
        userId: userId,
        schemaId: id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      access: {
        id: access.id,
        userId: access.userId,
        createdAt: access.createdAt,
        user: access.user
      }
    })
  } catch (error) {
    console.error('Error granting schema access:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/schemas/[id]/access - Revoke access to schema
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.sub) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Check if user owns the schema
    const schema = await prisma.schema.findUnique({
      where: { id }
    })

    if (!schema) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      )
    }

    if (schema.userId !== token.sub) {
      return NextResponse.json(
        { error: 'Only the schema owner can revoke access' },
        { status: 403 }
      )
    }

    // Remove access
    await prisma.schemaAccess.delete({
      where: {
        userId_schemaId: {
          userId: userId,
          schemaId: id
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Access revoked successfully'
    })
  } catch (error) {
    console.error('Error revoking schema access:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
