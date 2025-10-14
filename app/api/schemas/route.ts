import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { SchemaVisibility } from '@prisma/client'

// GET /api/schemas - List all schemas for a session
export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    // Get session token from cookies for anonymous users
    const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                        request.cookies.get('__Secure-next-auth.session-token')?.value

    let userId = token?.sub || null
    let sessionId = null
    
    // For anonymous users, try to find session
    if (!userId && sessionToken) {
      try {
        const session = await prisma.session.findUnique({
          where: { sessionToken },
          include: { user: true }
        })

        if (session && session.expires > new Date()) {
          userId = session.userId
          sessionId = userId // Use userId as sessionId for logged-in users
        }
      } catch (sessionError) {
        console.log('No valid session found')
      }
    }

    // If no valid session, check for guest sessionId in query params
    if (!sessionId) {
      const { searchParams } = new URL(request.url)
      sessionId = searchParams.get('sessionId')
    }

    // Build where clause based on user's access
    let whereClause: any = {}

    if (userId) {
      // Authenticated user can see:
      // - Their own schemas
      // - Organization schemas (if member)
      // - Public schemas
      // - Private schemas they have access to
      
      // Get user's organization
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true }
      })

      whereClause = {
        OR: [
          { userId: userId }, // Own schemas
          { visibility: SchemaVisibility.PUBLIC }, // Public schemas
          {
            AND: [
              { visibility: SchemaVisibility.INTERNAL },
              { organizationId: user?.organizationId } // Organization schemas
            ]
          },
          {
            AND: [
              { visibility: SchemaVisibility.PRIVATE },
              { schemaAccess: { some: { userId: userId } } } // Private schemas with access
            ]
          }
        ]
      }
    } else if (sessionId) {
      // Anonymous users can only see their own schemas and public schemas
      whereClause = {
        OR: [
          { sessionId: sessionId }, // Own schemas
          { visibility: SchemaVisibility.PUBLIC } // Public schemas
        ]
      }
    } else {
      // No session, return empty array
      return NextResponse.json({ schemas: [] })
    }

    const schemas = await prisma.schema.findMany({
      where: whereClause,
      include: {
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
            slug: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json({ schemas })
  } catch (error) {
    console.error('Error fetching schemas:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/schemas - Create a new schema
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })

    const body = await request.json()
    const { name, description, graphJson, visibility = SchemaVisibility.PRIVATE, organizationId } = body

    if (!name || !graphJson) {
      return NextResponse.json(
        { error: 'Name and graphJson are required' },
        { status: 400 }
      )
    }

    const userId = token?.sub || null
    let sessionId = null

    // For anonymous users, generate a session ID
    if (!userId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    } else {
      sessionId = userId // Use userId as sessionId for logged-in users
    }

    // Check if schema name already exists for this user/organization
    const existingSchema = await prisma.schema.findFirst({
      where: {
        name: name,
        OR: [
          { userId: userId },
          { sessionId: sessionId },
          { organizationId: organizationId }
        ]
      }
    })

    if (existingSchema) {
      return NextResponse.json(
        { error: 'Schema with this name already exists' },
        { status: 400 }
      )
    }

    // Create the schema
    const schema = await prisma.schema.create({
      data: {
        name,
        description,
        graphJson,
        visibility,
        userId: userId,
        sessionId: sessionId,
        organizationId: organizationId
      },
      include: {
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
            slug: true
          }
        }
      }
    })

    return NextResponse.json({ schema })
  } catch (error) {
    console.error('Error creating schema:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}