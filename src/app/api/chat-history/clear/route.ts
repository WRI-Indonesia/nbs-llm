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