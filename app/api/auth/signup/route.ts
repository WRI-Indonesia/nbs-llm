import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

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

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    })

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
    console.error("Sign up error:", error)
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
