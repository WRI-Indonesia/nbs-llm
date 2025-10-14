import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error('Organizations fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }
}

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

    const { name, description } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    // Generate slug from name
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    
    // Ensure slug is not empty
    if (!slug) {
      slug = 'organization-' + Date.now()
    }
    
    // Check if slug already exists and make it unique
    let counter = 1
    const originalSlug = slug
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${originalSlug}-${counter}`
      counter++
    }

    // Use a transaction to ensure both operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Create the organization
      const organization = await tx.organization.create({
        data: {
          name: name.trim(),
          description: description?.trim(),
          slug,
          ownerId: userId
        }
      })

      // Create membership record for the owner
      await tx.organizationMembership.create({
        data: {
          userId: userId,
          organizationId: organization.id,
          role: 'OWNER'
        }
      })

      // Update user's organizationId if they don't have one
      await tx.user.update({
        where: { id: userId },
        data: { organizationId: organization.id }
      })

      return organization
    })

    return NextResponse.json({ organization: result })
  } catch (error) {
    console.error('Organization creation error:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json({ error: 'An organization with this name already exists' }, { status: 400 })
      }
      if (error.message.includes('Foreign key constraint')) {
        return NextResponse.json({ error: 'Invalid user data' }, { status: 400 })
      }
    }
    
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
  }
}
