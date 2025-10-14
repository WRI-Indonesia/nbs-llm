import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { OrganizationRole, InvitationStatus } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { emailService } from '@/lib/email'

// Get organization members
export async function GET(request: NextRequest) {
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
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Check if user has access to this organization
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: organizationId
        }
      }
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get organization members
    const members = await prisma.organizationMembership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, etc.
        { joinedAt: 'asc' }
      ]
    })

    // Get pending invitations
    const invitations = await prisma.organizationInvitation.findMany({
      where: { 
        organizationId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() }
      },
      include: {
        inviter: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      members: members.map(m => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user
      })),
      invitations: invitations.map(i => ({
        id: i.id,
        email: i.email,
        role: i.role,
        status: i.status,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        inviter: i.inviter
      })),
      currentUserRole: membership.role
    })
  } catch (error) {
    console.error('Error fetching organization members:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Invite member to organization
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
    const { organizationId, email, role = OrganizationRole.MEMBER } = body

    if (!organizationId || !email) {
      return NextResponse.json(
        { error: 'Organization ID and email are required' },
        { status: 400 }
      )
    }

    // Check if user has permission to invite (must be OWNER or ADMIN)
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: organizationId
        }
      }
    })

    if (!membership || (membership.role !== OrganizationRole.OWNER && membership.role !== OrganizationRole.ADMIN)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { organizationId }
        }
      }
    })

    if (existingUser?.memberships && existingUser.memberships.length > 0) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 400 }
      )
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.organizationInvitation.findUnique({
      where: {
        email_organizationId: {
          email,
          organizationId
        }
      }
    })

    if (existingInvitation && existingInvitation.status === InvitationStatus.PENDING) {
      return NextResponse.json(
        { error: 'Invitation already sent to this email' },
        { status: 400 }
      )
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        owner: {
          select: { name: true, email: true }
        }
      }
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Create invitation
    const invitationToken = uuidv4()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days from now

    const invitation = await prisma.organizationInvitation.create({
      data: {
        email,
        organizationId,
        role,
        invitedBy: userId,
        token: invitationToken,
        expiresAt
      }
    })

    // Send invitation email
    const invitationUrl = `${process.env.NEXTAUTH_URL}/organizations/invite/${invitationToken}`
    
    console.log('Sending invitation email to:', email)
    console.log('Organization:', organization.name)
    console.log('Role:', role)
    
    await emailService.sendEmail({
      to: email,
      subject: `Invitation to join ${organization.name}`,
      html: emailService.generateOrganizationInvitationEmailHtml(
        email,
        organization.name,
        role,
        invitationUrl,
        organization.owner.name || organization.owner.email
      )
    })

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt
      }
    })
  } catch (error) {
    console.error('Error inviting member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update member role or remove member
export async function PUT(request: NextRequest) {
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
    const { organizationId, userId: targetUserId, role, action } = body

    if (!organizationId || !targetUserId) {
      return NextResponse.json(
        { error: 'Organization ID and user ID are required' },
        { status: 400 }
      )
    }

    // Check if user has permission to manage members (OWNER or ADMIN)
    const requesterMembership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: userId,
          organizationId: organizationId
        }
      }
    })

    if (!requesterMembership || (requesterMembership.role !== OrganizationRole.OWNER && requesterMembership.role !== OrganizationRole.ADMIN)) {
      return NextResponse.json(
        { error: 'Only organization owners and admins can manage members' },
        { status: 403 }
      )
    }

    // Prevent users from changing their own role
    if (targetUserId === userId) {
      return NextResponse.json(
        { error: 'Cannot modify your own role' },
        { status: 400 }
      )
    }

    if (action === 'remove') {
      // Remove member
      await prisma.organizationMembership.delete({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId
          }
        }
      })

      return NextResponse.json({ success: true, message: 'Member removed successfully' })
    } else if (action === 'update' && role) {
      // Update member role
      const updatedMembership = await prisma.organizationMembership.update({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId
          }
        },
        data: { role }
      })

      return NextResponse.json({
        success: true,
        membership: {
          id: updatedMembership.id,
          userId: updatedMembership.userId,
          role: updatedMembership.role
        }
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
