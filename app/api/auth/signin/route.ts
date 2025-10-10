import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Verify password
    const isCorrectPassword = await bcrypt.compare(password, user.password)
    if (!isCorrectPassword) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // Generate sessionId
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create session in database
    await prisma.session.create({
      data: {
        sessionToken: sessionId,
        userId: user.id,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    })

    return NextResponse.json({
      sessionId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    })
  } catch (error: any) {
    console.error("Sign in error:", error)
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack
    })
    return NextResponse.json(
      { error: "Something went wrong", details: error.message },
      { status: 500 }
    )
  }
}
