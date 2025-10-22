import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface ClearChatHistoryRequest {
  projectId?: string // Optional - if not provided, clears all chat history for user
}

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body: ClearChatHistoryRequest = await request.json()
    const { projectId } = body

    // Clear chat history for the user
    const whereClause = projectId 
      ? { userId: user.id, projectId }
      : { userId: user.id }

    const deletedCount = await (prisma as any).chatHistory.deleteMany({
      where: whereClause
    })

    return NextResponse.json({
      success: true,
      message: projectId 
        ? `Cleared ${deletedCount.count} chat messages for project ${projectId}`
        : `Cleared ${deletedCount.count} chat messages for user`,
      deletedCount: deletedCount.count,
      projectId: projectId || 'all'
    })

  } catch (error) {
    console.error('Error clearing chat history:', error)
    return NextResponse.json({ 
      error: 'Failed to clear chat history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

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

    const history = await (prisma as any).chatHistory.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'asc'
      },
      take: 50 // Limit to last 50 messages
    })

    const chatHistory = history.map((msg: any) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
      projectId: msg.projectId
    }))

    return NextResponse.json({
      success: true,
      chatHistory,
      totalMessages: history.length,
      projectId: projectId || 'all'
    })

  } catch (error) {
    console.error('Error fetching chat history:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch chat history',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
