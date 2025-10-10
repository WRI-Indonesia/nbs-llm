import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ user: null })
    }

    // Find session in database
    const session = await prisma.session.findUnique({
      where: { sessionToken: sessionId },
      include: { user: true }
    })

    if (!session || session.expires < new Date()) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email
      }
    })
  } catch (error: any) {
    console.error("Session check error:", error)
    return NextResponse.json({ user: null })
  }
}
