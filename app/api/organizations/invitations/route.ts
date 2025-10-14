import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { InvitationStatus, OrganizationRole } from '@prisma/client'

// Accept organization invitation
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { token: invitationToken } = body

    if (!invitationToken) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    // Find the invitation
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { token: invitationToken },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      )
    }

    // Check if invitation is still valid
    if (invitation.status !== InvitationStatus.PENDING) {
      return NextResponse.json(
        { error: 'Invitation has already been processed' },
        { status: 400 }
      )
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    // Check if the user's email matches the invitation
    const user = await prisma.user.findUnique({
      where: { id: token.sub }
    })

    if (user?.email !== invitation.email) {
      return NextResponse.json(
        { error: 'This invitation is not for your email address' },
        { status: 403 }
      )
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: token.sub,
          organizationId: invitation.organizationId
        }
      }
    })

    if (existingMembership) {
      // Mark invitation as accepted even though user is already a member
      await prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED }
      })

      return NextResponse.json({
        success: true,
        message: 'You are already a member of this organization',
        organization: invitation.organization
      })
    }

    // Create membership
    await prisma.organizationMembership.create({
      data: {
        userId: token.sub,
        organizationId: invitation.organizationId,
        role: invitation.role
      }
    })

    // Update user's organizationId if they don't have one
    if (!user?.organizationId) {
      await prisma.user.update({
        where: { id: token.sub },
        data: { organizationId: invitation.organizationId }
      })
    }

    // Mark invitation as accepted
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.ACCEPTED }
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the organization',
      organization: invitation.organization
    })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Decline organization invitation
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const invitationToken = searchParams.get('token')

    if (!invitationToken) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      )
    }

    // Find the invitation
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { token: invitationToken }
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      )
    }

    // Check if the user's email matches the invitation
    const user = await prisma.user.findUnique({
      where: { id: token.sub }
    })

    if (user?.email !== invitation.email) {
      return NextResponse.json(
        { error: 'This invitation is not for your email address' },
        { status: 403 }
      )
    }

    // Mark invitation as declined
    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.DECLINED }
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation declined'
    })
  } catch (error) {
    console.error('Error declining invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
