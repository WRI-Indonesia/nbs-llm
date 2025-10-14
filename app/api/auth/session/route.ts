import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    // Use NextAuth's built-in session handling
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ user: null })
    }

    // Get additional user data from database if needed
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        organization: true
      }
    })

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        emailVerified: user.emailVerified,
        organizationId: user.organizationId,
        organization: user.organization,
        createdAt: user.createdAt
      }
    })
  } catch (error: unknown) {
    console.error("Session check error:", error)
    return NextResponse.json({ user: null })
  }
}
