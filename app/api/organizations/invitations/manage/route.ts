import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { OrganizationRole } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { emailService } from '@/lib/email'

// Cancel/Delete organization invitation
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

    // Get the user ID from the token (could be token.sub or token.id)
    const userId = (token as any).id || token.sub
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('invitationId')

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      )
    }

    // Get the invitation
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: true
      }
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Check if user has permission to cancel invitations (must be OWNER or ADMIN)
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: invitation.organizationId
        }
      }
    })

    if (!membership || (membership.role !== OrganizationRole.OWNER && membership.role !== OrganizationRole.ADMIN)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Delete the invitation
    await prisma.organizationInvitation.delete({
      where: { id: invitationId }
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation cancelled successfully'
    })
  } catch (error) {
    console.error('Error cancelling invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Resend organization invitation
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

    // Get the user ID from the token (could be token.sub or token.id)
    const userId = (token as any).id || token.sub
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 })
    }

    const body = await request.json()
    const { invitationId } = body

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      )
    }

    // Get the invitation
    const invitation = await prisma.organizationInvitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: {
          include: {
            owner: {
              select: { name: true, email: true }
            }
          }
        }
      }
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Check if user has permission to resend invitations (must be OWNER or ADMIN)
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: invitation.organizationId
        }
      }
    })

    if (!membership || (membership.role !== OrganizationRole.OWNER && membership.role !== OrganizationRole.ADMIN)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Generate new token and extend expiration
    const newToken = uuidv4()
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 7) // 7 days from now

    // Update the invitation with new token and expiration
    const updatedInvitation = await prisma.organizationInvitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt
      }
    })

    // Send invitation email
    const invitationUrl = `${process.env.NEXTAUTH_URL}/organizations/invite/${newToken}`
    
    console.log('Resending invitation email to:', invitation.email)
    console.log('Organization:', invitation.organization.name)
    console.log('Role:', invitation.role)
    
    await emailService.sendEmail({
      to: invitation.email,
      subject: `Invitation to join ${invitation.organization.name}`,
      html: emailService.generateOrganizationInvitationEmailHtml(
        invitation.email,
        invitation.organization.name,
        invitation.role,
        invitationUrl,
        invitation.organization.owner.name || invitation.organization.owner.email
      )
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation resent successfully',
      invitation: {
        id: updatedInvitation.id,
        email: updatedInvitation.email,
        role: updatedInvitation.role,
        expiresAt: updatedInvitation.expiresAt
      }
    })
  } catch (error) {
    console.error('Error resending invitation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
