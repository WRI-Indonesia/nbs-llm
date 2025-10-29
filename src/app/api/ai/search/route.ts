import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { repromptQuery } from './_utils/reprompt-query-agent'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { MinioDocMatch, NodeDocMatch, SearchRequest } from './_utils/types'
import { createErrorResponse, createSuccessResponse } from './_utils/response-handler'
import { createUpdatedChatHistory, getChatHistoryFromDB, saveChatHistoryToDB } from './_utils/chat-history-utils'
import { generateQueryEmbedding } from './_utils/generate-embedding-agent'
import { generateSQLQuery } from './_utils/generate-sql-agent'
import { executeSQLQuery } from './_utils/sql-utils'
import { generateAnswer } from './_utils/summarization-agent'

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser()
    if (!user?.email) {
      return createErrorResponse('Authentication required', undefined, 401)
    }

    const body: SearchRequest = await request.json()
    const { query, min_cosine = 0.2, top_k = 5, projectId, location = { district: [], province: [] } } = body

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


    /**
     * RE-PROMPT QUERY AGENT
     * Re-prompt query to handle typo, .etc and improve user query to generate better SQL
     */
    const repromtResult = await repromptQuery(query, location.district)
    const newQuery = repromtResult.result

    // If prompt is unable to re-prompt it will return false
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
      })
    }

    /*
    * GENERATE EMBEDDING AGENT
    * We need to generate embedding from re-prompt query agent
    * so later we can find similarity in DB
    */
    const queryEmbedding = await generateQueryEmbedding(newQuery)
    const embeddingStr = JSON.stringify(queryEmbedding);

    // Excecute function to get similar data from DB
    const relevantNodeDocs = await prisma.$queryRaw<NodeDocMatch[]>`
    SELECT * FROM public.match_node_docs(${embeddingStr}, ${top_k}, ${min_cosine})
    `

    const relevantMinioDocs = await prisma.$queryRaw<MinioDocMatch[]>`
    SELECT * FROM public.match_minio_docs(${embeddingStr}, ${top_k}, ${min_cosine})
    `

    // // Get all Node documents with embeddings
    // const ragDocs = await (prisma.nodeDocs.findMany as any)({
    //   where: {
    //     embedding: {
    //       not: null
    //     }
    //   },
    //   include: {
    //     node: {
    //       include: {
    //         project: true
    //       }
    //     }
    //   }
    // })

    // // Search for relevant RAG documents
    // const relevantDocs = await searchRagDocuments(ragDocs, queryEmbedding, min_cosine, top_k)

    // if (relevantDocs.length === 0) {
    //   const updatedChatHistory = createUpdatedChatHistory(
    //     chatHistory,
    //     query,
    //     'No relevant schema information found to generate a query.',
    //     { ragDocuments: [] }
    //   )

    //   // Save chat history to database
    //   await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

    //   return createSuccessResponse(query, updatedChatHistory, {
    //     message: 'No relevant schema information found for the given query',
    //     answer: 'No relevant schema information found to generate a query.',
    //     relevantDocuments: []
    //   })
    // }

    // Initiate data as empty array
    let data = []

    // only generate SQL Query if relevantNodeDocs is not empty
    if (relevantNodeDocs.length !== 0) {
      const relevantNodeDocsText = relevantNodeDocs.map((r) => r.document_text)
      const sqlQuery = await generateSQLQuery(newQuery, relevantNodeDocsText)
      const executionResult = await executeSQLQuery(sqlQuery, projectId)

      console.log(sqlQuery)
      console.log(executionResult)
    }

    return createSuccessResponse(query, [], {
      message: 'Failed to generate SQL query',
      answer: 'Unable to generate a valid SQL query for the given question.',
      // relevantDocuments: mapRelevantDocuments(relevantDocs)
    })
    /**
     * GENERATE SQL AGENT
     * Generate SQL query using the relevant documents
     */
    const sqlQuery = await generateSQLQuery(newQuery, [])

    if (!sqlQuery) {
      const updatedChatHistory = createUpdatedChatHistory(
        chatHistory,
        query,
        'Unable to generate a valid SQL query for the given question.',
        // { ragDocuments: mapRelevantDocuments(relevantDocs) }
      )

      // Save chat history to database
      await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

      return createSuccessResponse(query, updatedChatHistory, {
        message: 'Failed to generate SQL query',
        answer: 'Unable to generate a valid SQL query for the given question.',
        // relevantDocuments: mapRelevantDocuments(relevantDocs)
      })
    }

    /**
     * EXCECUTE GENERATED SQL
     */
    let executionResult: any[] = []
    try {
      executionResult = await executeSQLQuery(sqlQuery, projectId)
    } catch (executionError) {
      const updatedChatHistory = createUpdatedChatHistory(
        chatHistory,
        query,
        `Query generated but execution failed: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`,
        {
          sqlQuery: sqlQuery,
          // ragDocuments: mapRelevantDocuments(relevantDocs)
        }
      )

      // Save chat history to database
      await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

      return createSuccessResponse(query, updatedChatHistory, {
        sqlQuery,
        answer: `Query generated but execution failed: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`,
        // relevantDocuments: mapRelevantDocuments(relevantDocs),
        // searchStats: createSearchStats(relevantDocs.length, min_cosine, top_k)
      })
    }

    /**
     * SUMMARIZATION AGENT
     * Combine improved user query, data from excecuted SQL, and context from RAG Minio
     */
    const answer = await generateAnswer(newQuery, executionResult, [])

    // Create updated chat history with the new exchange
    const updatedChatHistory = createUpdatedChatHistory(
      chatHistory,
      query,
      answer,
      {
        sqlQuery: sqlQuery,
        // ragDocuments: mapRelevantDocuments(relevantDocs),
        data: executionResult
      }
    )

    // Save chat history to database
    await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

    return createSuccessResponse(query, updatedChatHistory, {
      sqlQuery,
      answer: answer,
      data: executionResult,
      // relevantDocuments: mapRelevantDocuments(relevantDocs),
      // searchStats: createSearchStats(relevantDocs.length, min_cosine, top_k)
    })

  } catch (error) {
    console.error('Error in search API:', error)

    return createErrorResponse(
      'Failed to process search query',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
