import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { v4 as uuidv4 } from "uuid"
import { emailService } from "@/lib/email"

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, organizationId } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Generate verification token
    const verificationToken = uuidv4()

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        ...(organizationId && { organizationId })
      },
      include: {
        organization: true
      }
    })

    // Generate session token
    const sessionToken = uuidv4()

    // Create session in database
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    })

    // Create response with cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    })

    // Set session cookie
    response.cookies.set('next-auth.session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    })

    // Send verification email
    const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${verificationToken}`
    
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Verify Your Email - Flow Schema Designer',
        html: emailService.generateVerificationEmailHtml(user.name || 'User', verificationUrl)
      })
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Don't fail the signup if email sending fails
    }

    return response
  } catch (error: unknown) {
    console.error("Sign up error:", error)
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      code: (error as any)?.code,
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: "Something went wrong", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
