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

    const { name, description } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        slug,
        ownerId: token.sub
      }
    })

    // Add the creator as a member
    await prisma.user.update({
      where: { id: token.sub },
      data: { organizationId: organization.id }
    })

    return NextResponse.json({ organization })
  } catch (error) {
    console.error('Organization creation error:', error)
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
  }
}
