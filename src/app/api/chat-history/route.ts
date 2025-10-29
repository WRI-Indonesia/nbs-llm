import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

// GET endpoint to retrieve chat history for a user
export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    // Get chat history from database
    const whereClause = projectId
      ? { userId: user.id, projectId }
      : { userId: user.id }

    const chatHistory = await prisma.chatHistory.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'asc'
      },
    })

    return NextResponse.json({
      chatHistory,
    })

  } catch (error) {
    console.error('Error fetching chat history:', error)
    return NextResponse.json({
      error: 'Failed to fetch chat history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
