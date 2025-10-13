import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                        request.cookies.get('__Secure-next-auth.session-token')?.value

    if (!sessionToken) {
      return NextResponse.json({ user: null })
    }

    // Find session in database
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: { 
        user: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!session || session.expires < new Date()) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        emailVerified: session.user.emailVerified,
        organizationId: session.user.organizationId,
        organization: session.user.organization,
        createdAt: session.user.createdAt
      }
    })
  } catch (error: unknown) {
    console.error("Session check error:", error)
    return NextResponse.json({ user: null })
  }
}
