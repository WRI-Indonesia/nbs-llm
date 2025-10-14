import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

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

    // Get user's organizations through memberships
    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    })

    // Also get organizations the user owns
    const ownedOrganizations = await prisma.organization.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Combine and deduplicate organizations
    const allOrgs = [...memberships.map(m => ({ ...m.organization, role: m.role })), ...ownedOrganizations.map(o => ({ ...o, role: 'OWNER' }))]
    const uniqueOrgs = allOrgs.filter((org, index, self) => 
      index === self.findIndex(o => o.id === org.id)
    )

    return NextResponse.json({ 
      organizations: uniqueOrgs,
      currentOrganizationId: null // Will be set by the user
    })
  } catch (error) {
    console.error('Error fetching user organizations:', error)
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
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

    const { organizationId } = await request.json()

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { organizationId },
      include: {
        organization: true
      }
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Organization update error:', error)
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 })
  }
}
