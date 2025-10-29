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
export async function saveChatHistoryToDB(chatHistory: Omit<ChatHistory, 'id'>): Promise<void> {
  try {
    await prisma.chatHistory.create({
      data: {
        userId: chatHistory.userId,
        projectId: chatHistory.projectId,
        role: chatHistory.role,
        content: chatHistory.content,
        sqlQuery: chatHistory.sqlQuery || null,
        data: chatHistory.data ? JSON.stringify(chatHistory.data) : undefined,
        ragMinioDocuments: chatHistory.ragMinioDocuments ? JSON.stringify(chatHistory.ragMinioDocuments) : undefined,
        ragNodeDocuments: chatHistory.ragNodeDocuments ? JSON.stringify(chatHistory.ragNodeDocuments) : undefined,
        timestamp: new Date(chatHistory.timestamp || new Date().toISOString())
      }
    })
  } catch (error) {
    console.error('Error saving chat history:', error)
  }
}