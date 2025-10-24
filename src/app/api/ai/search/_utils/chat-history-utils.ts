import { prisma } from '@/lib/prisma'
import { ChatMessage } from './response-utils'

/**
 * Gets chat history from database for a specific user and project
 */
export async function getChatHistoryFromDB(userId: string, projectId: string): Promise<ChatMessage[]> {
  try {
    const history = await (prisma as any).chatHistory.findMany({
      where: {
        userId,
        projectId
      },
      orderBy: {
        timestamp: 'asc'
      },
      take: 20 // Limit to last 20 messages
    })

    return history.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
      sqlQuery: msg.sqlQuery || undefined,
      ragDocuments: msg.ragDocuments ? JSON.parse(msg.ragDocuments) : undefined
    }))
  } catch (error) {
    console.error('Error fetching chat history:', error)
    return []
  }
}

/**
 * Saves chat history to database for a specific user and project
 */
export async function saveChatHistoryToDB(userId: string, projectId: string, messages: ChatMessage[]): Promise<void> {
  try {
    // Get the last 2 messages (user query + assistant response)
    const lastMessages = messages.slice(-2)

    for (const message of lastMessages) {
      await (prisma as any).chatHistory.create({
        data: {
          userId,
          projectId,
          role: message.role,
          content: message.content,
          sqlQuery: message.sqlQuery || null,
          data: message.data ? JSON.stringify(message.data) : null,
          ragDocuments: message.ragDocuments ? JSON.stringify(message.ragDocuments) : null,
          timestamp: new Date(message.timestamp || new Date().toISOString())
        }
      })
    }
  } catch (error) {
    console.error('Error saving chat history:', error)
  }
}

/**
 * Creates a new chat message with current timestamp
 */
export function createChatMessage(
  role: 'user' | 'assistant',
  content: string,
  options: {
    sqlQuery?: string
    ragDocuments?: any[]
    data?: any
  } = {}
): ChatMessage {
  return {
    role,
    content,
    timestamp: new Date().toISOString(),
    sqlQuery: options.sqlQuery,
    ragDocuments: options.ragDocuments,
    data: options.data
  }
}

/**
 * Creates updated chat history by adding new user and assistant messages
 */
export function createUpdatedChatHistory(
  existingHistory: ChatMessage[],
  userQuery: string,
  assistantResponse: string,
  options: {
    sqlQuery?: string
    ragDocuments?: any[]
    data?: any
  } = {}
): ChatMessage[] {
  const userMessage = createChatMessage('user', userQuery)
  const assistantMessage = createChatMessage('assistant', assistantResponse, options)
  
  return [...existingHistory, userMessage, assistantMessage]
}
