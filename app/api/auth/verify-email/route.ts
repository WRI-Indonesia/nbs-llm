import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Verify email with token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Verification token is required' }, { status: 400 })
    }

    // Find user with this verification token
    const user = await prisma.user.findFirst({
      where: { 
        emailVerificationToken: token,
        emailVerified: null // Not already verified
      }
    })

    if (!user) {
      return NextResponse.json({ 
        error: 'Invalid or expired verification token' 
      }, { status: 400 })
    }

    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - new Date(user.createdAt).getTime()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    if (tokenAge > maxAge) {
      // Clear the expired token
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationToken: null }
      })
      
      return NextResponse.json({ 
        error: 'Verification token has expired. Please request a new one.' 
      }, { status: 400 })
    }

    // Verify the email
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        emailVerified: new Date(),
        emailVerificationToken: null // Clear the token
      }
    })

    // Redirect to success page
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/email-verified`)
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 })
  }
}
