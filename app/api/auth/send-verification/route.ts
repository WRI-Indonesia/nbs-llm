import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { emailService } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

// Send verification email
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (!token?.sub) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: token.sub }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email already verified' }, { status: 400 })
    }

    // Generate new verification token
    const verificationToken = uuidv4()
    
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: verificationToken }
    })

    // Create verification URL
    const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verificationToken}`

    // Send verification email
    const emailResult = await emailService.sendEmail({
      to: user.email,
      subject: 'Verify Your Email - Flow Schema Designer',
      html: emailService.generateVerificationEmailHtml(user.name || 'User', verificationUrl)
    })

    if (!emailResult.success) {
      return NextResponse.json({ 
        error: 'Failed to send verification email',
        details: emailResult.error 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Verification email sent successfully' 
    })
  } catch (error) {
    console.error('Send verification email error:', error)
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
  }
}
