import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId } = await request.json()

    const updatedUser = await prisma.user.update({
      where: { id: token.sub },
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
