import { prisma } from '@/lib/prisma'
import { ChatHistory } from '@prisma/client'

/**
 * Gets chat history from database for a specific user and project
 */
export async function getChatHistoryFromDB(userId: string, projectId: string): Promise<ChatHistory[]> {
  try {
    const history = await prisma.chatHistory.findMany({
      where: {
        userId,
        projectId
      },
      orderBy: {
        timestamp: 'asc'
      },
    })

    return history
  } catch (error) {
    console.error('Error fetching chat history:', error)
    return []
  }
}

/**
 * Saves chat history to database for a specific user and project
 */
type SaveChatHistoryInput = {
  userId: string
  projectId: string
  role: string
  content: string
  sqlQuery?: string | null
  ragNodeDocuments?: any
  ragMinioDocuments?: any
  improvedPrompt?: string | null
  data?: any
  timestamp: Date | string
  tokenUsage?: any
  tokenCost?: any
}

export async function saveChatHistoryToDB(chatHistory: SaveChatHistoryInput): Promise<void> {
  try {
    // Verify user exists before attempting to save
    const userExists = await prisma.user.findUnique({
      where: { id: chatHistory.userId },
      select: { id: true }
    })
    
    if (!userExists) {
      console.error(`Cannot save chat history: User ${chatHistory.userId} does not exist in database`)
      return
    }

    await prisma.chatHistory.create({
      data: {
        userId: chatHistory.userId,
        projectId: chatHistory.projectId,
        role: chatHistory.role,
        content: chatHistory.content,
        sqlQuery: chatHistory.sqlQuery || null,
        data: chatHistory.data ? (typeof chatHistory.data === 'string' ? JSON.parse(chatHistory.data) : chatHistory.data) : undefined,
        ragMinioDocuments: chatHistory.ragMinioDocuments ? (typeof chatHistory.ragMinioDocuments === 'string' ? JSON.parse(chatHistory.ragMinioDocuments) : chatHistory.ragMinioDocuments) : undefined,
        ragNodeDocuments: chatHistory.ragNodeDocuments ? (typeof chatHistory.ragNodeDocuments === 'string' ? JSON.parse(chatHistory.ragNodeDocuments) : chatHistory.ragNodeDocuments) : undefined,
        improvedPrompt: chatHistory.improvedPrompt || null,
        tokenUsage: chatHistory.tokenUsage ? (typeof chatHistory.tokenUsage === 'string' ? JSON.parse(chatHistory.tokenUsage) : chatHistory.tokenUsage) : undefined,
        tokenCost: chatHistory.tokenCost ? (typeof chatHistory.tokenCost === 'string' ? JSON.parse(chatHistory.tokenCost) : chatHistory.tokenCost) : undefined,
        timestamp: new Date(chatHistory.timestamp || new Date().toISOString())
      } as any
    })
  } catch (error: any) {
    // Provide more specific error messages
    if (error?.code === 'P2003') {
      console.error(`Error saving chat history: Foreign key constraint violation. User ${chatHistory.userId} or project ${chatHistory.projectId} does not exist.`)
    } else {
      console.error('Error saving chat history:', error)
    }
    // Don't throw - allow the API to continue even if chat history saving fails
  }
}