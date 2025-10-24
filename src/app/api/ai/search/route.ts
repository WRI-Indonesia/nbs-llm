import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { 
  createSuccessResponse, 
  createErrorResponse, 
  mapRelevantDocuments, 
  createSearchStats,
  ChatMessage 
} from './_utils/response-utils'
import { 
  getChatHistoryFromDB, 
  saveChatHistoryToDB, 
  createUpdatedChatHistory 
} from './_utils/chat-history-utils'
import { 
  generateQueryEmbedding, 
  generateSQLQuery, 
  executeSQLQuery 
} from './_utils/sql-utils'
import { searchRagDocuments } from './_utils/rag-utils'
import { repromptQuery } from './_utils/query-utils'

export interface SearchRequest {
  query: string
  min_cosine?: number
  top_k?: number
  projectId: string
  chatHistory?: ChatMessage[]
  location?: {
    district: string[]
    province: string[]
  }
}


export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser()
    if (!user?.email) {
      return createErrorResponse('Authentication required', undefined, 401)
    }

    const body: SearchRequest = await request.json()
    const { query, min_cosine = 0.7, top_k = 5, projectId, location = { district: [], province: [] } } = body

    // Get chat history from database if not provided
    const chatHistory = body.chatHistory || await getChatHistoryFromDB(user.id, projectId)

    if (!query) {
      return createErrorResponse('Query is required', undefined, 400)
    }

    if (!projectId) {
      return createErrorResponse('Project ID is required', undefined, 400)
    }

    if (min_cosine < 0 || min_cosine > 1) {
      return createErrorResponse('min_cosine must be between 0 and 1', undefined, 400)
    }

    if (top_k < 1 || top_k > 20) {
      return createErrorResponse('top_k must be between 1 and 20', undefined, 400)
    }

    // Re-prompt query to handle inputted district
    const repromtResult = await repromptQuery(query, location.district)
    const newQuery = repromtResult.result
    console.log('newQuery', newQuery)

    if (newQuery === 'false') {
      const updatedChatHistory = createUpdatedChatHistory(
        chatHistory,
        query,
        'Please try to input your location in Zip File or choose any location on your query fisrt'
      )

      // Save chat history to database
      await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

      return createSuccessResponse(query, updatedChatHistory, {
        content: 'Please try to input your location in Zip File or choose any location on your query fisrt',
        searchStats: createSearchStats(0, min_cosine, top_k)
      })
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateQueryEmbedding(newQuery)

    // Search for relevant RAG documents
    const relevantDocs = await searchRagDocuments(queryEmbedding, min_cosine, top_k)

    if (relevantDocs.length === 0) {
      const updatedChatHistory = createUpdatedChatHistory(
        chatHistory,
        query,
        'No relevant schema information found to generate a query.',
        { ragDocuments: [] }
      )

      // Save chat history to database
      await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

      return createSuccessResponse(query, updatedChatHistory, {
        message: 'No relevant schema information found for the given query',
        answer: 'No relevant schema information found to generate a query.',
        relevantDocuments: []
      })
    }

    // Generate SQL query using the relevant documents
    const sqlQuery = await generateSQLQuery(newQuery, relevantDocs)

    if (!sqlQuery) {
      const updatedChatHistory = createUpdatedChatHistory(
        chatHistory,
        query,
        'Unable to generate a valid SQL query for the given question.',
        { ragDocuments: mapRelevantDocuments(relevantDocs) }
      )

      // Save chat history to database
      await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

      return createSuccessResponse(query, updatedChatHistory, {
        message: 'Failed to generate SQL query',
        answer: 'Unable to generate a valid SQL query for the given question.',
        relevantDocuments: mapRelevantDocuments(relevantDocs)
      })
    }

    // Execute the SQL query
    let executionResult
    try {
      executionResult = await executeSQLQuery(sqlQuery, projectId, newQuery, chatHistory)
    } catch (executionError) {
      const updatedChatHistory = createUpdatedChatHistory(
        chatHistory,
        query,
        `Query generated but execution failed: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`,
        { 
          sqlQuery: sqlQuery,
          ragDocuments: mapRelevantDocuments(relevantDocs)
        }
      )

      // Save chat history to database
      await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

      return createSuccessResponse(query, updatedChatHistory, {
        sqlQuery,
        answer: `Query generated but execution failed: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`,
        relevantDocuments: mapRelevantDocuments(relevantDocs),
        searchStats: createSearchStats(relevantDocs.length, min_cosine, top_k)
      })
    }

    // Create updated chat history with the new exchange
    const updatedChatHistory = createUpdatedChatHistory(
      chatHistory,
      query,
      executionResult.answer,
      {
        sqlQuery: sqlQuery,
        ragDocuments: mapRelevantDocuments(relevantDocs),
        data: executionResult.data
      }
    )

    // Save chat history to database
    await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

    return createSuccessResponse(query, updatedChatHistory, {
      sqlQuery,
      answer: executionResult.answer,
      data: executionResult.data,
      relevantDocuments: mapRelevantDocuments(relevantDocs),
      searchStats: createSearchStats(relevantDocs.length, min_cosine, top_k)
    })

  } catch (error) {
    console.error('Error in search API:', error)
    return createErrorResponse(
      'Failed to process search query',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
