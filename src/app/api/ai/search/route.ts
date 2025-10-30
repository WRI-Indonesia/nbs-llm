import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
// import { repromptQuery } from './_utils/reprompt-query-agent'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { MinioDocMatch, NodeDocMatch, SearchRequest } from './_utils/types'
import { createErrorResponse } from './_utils/response-handler'
import { saveChatHistoryToDB } from './_utils/chat-history-utils'
import { generateQueryEmbedding } from './_utils/generate-embedding-agent'
import { generateSQLQuery } from './_utils/generate-sql-agent'
import { executeSQLQuery } from './_utils/sql-utils'
import { rerankDocuments } from './_utils/rerank'
import { generateAnswer } from './_utils/summarization-agent'

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser()
    if (!user?.email) {
      return createErrorResponse('Authentication required', undefined, 401)
    }

    const body: SearchRequest = await request.json()
    const { 
      query, 
      min_cosine = 0.2, 
      top_k = 5, 
      projectId, 
      location = { district: [], province: [] }, 
      timestamp = new Date(),
      use_hybrid = true,  // Default to hybrid search
      hybrid_alpha = 0.7  // Default 70% vector, 30% keyword
    } = body

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

    if (use_hybrid && (hybrid_alpha < 0 || hybrid_alpha > 1)) {
      return createErrorResponse('hybrid_alpha must be between 0 and 1', undefined, 400)
    }

    // save user chat into DB
    await saveChatHistoryToDB({
      role: 'user',
      projectId,
      userId: user.id,
      content: query,
      sqlQuery: null,
      ragNodeDocuments: null,
      ragMinioDocuments: null,
      improvedPrompt: null,
      data: null,
      timestamp
    })

    /**
     * RE-PROMPT QUERY AGENT
     * Re-prompt query to handle typo, .etc and improve user query to generate better SQL
     */
    // const repromtResult = await repromptQuery(query, location.district)
    // const newQuery = repromtResult.result
    const newQuery = query

    // If prompt is unable to re-prompt it will return false
    if (newQuery === 'false') {
      // assistant
      await saveChatHistoryToDB({
        role: 'assistant',
        projectId,
        userId: user.id,
        content: 'Please try to input your location in Zip File or choose any location on your query fisrt',
        sqlQuery: null,
        ragNodeDocuments: null,
        ragMinioDocuments: null,
        improvedPrompt: null,
        data: null,
        timestamp: new Date()
      })

      return NextResponse.json({ status: 'success' })
    }

    /*
    * GENERATE EMBEDDING AGENT
    * We need to generate embedding from re-prompt query agent
    * so later we can find similarity in DB
    */
    const queryEmbedding = await generateQueryEmbedding(newQuery)
    const embeddingStr = JSON.stringify(queryEmbedding);

    // Use hybrid search if enabled, otherwise fall back to pure vector search
    let relevantNodeDocs: NodeDocMatch[]
    let relevantMinioDocs: MinioDocMatch[]

    if (use_hybrid) {
      // Hybrid search: combines vector similarity with keyword search (BM25-like)
      relevantNodeDocs = await prisma.$queryRaw<NodeDocMatch[]>(
        Prisma.sql`
        SELECT 
          * FROM 
          match_node_docs_hybrid(
            ${newQuery}::TEXT,
            ${embeddingStr}::TEXT,
            ${top_k}::INT,         
            ${min_cosine}::FLOAT,
            NULL,  -- node_id_filter
            ${hybrid_alpha}::FLOAT
          );
      `
      );

      relevantMinioDocs = await prisma.$queryRaw<MinioDocMatch[]>(
        Prisma.sql`
        SELECT 
          * FROM 
          match_minio_docs_hybrid(
            ${newQuery}::TEXT,
            ${embeddingStr}::TEXT,
            ${top_k}::INT,         
            ${min_cosine}::FLOAT,
            ${hybrid_alpha}::FLOAT
          );
      `
      );
    } else {
      // Pure vector search (original behavior)
      relevantNodeDocs = await prisma.$queryRaw<NodeDocMatch[]>(
        Prisma.sql`
        SELECT 
          * FROM 
          match_node_docs(
            ${embeddingStr}::TEXT,
            ${top_k}::INT,         
            ${min_cosine}::FLOAT 
          );
      `
      );

      relevantMinioDocs = await prisma.$queryRaw<MinioDocMatch[]>(
        Prisma.sql`
        SELECT 
          * FROM 
          match_minio_docs(
            ${embeddingStr}::TEXT,
            ${top_k}::INT,         
            ${min_cosine}::FLOAT 
          );
      `
      );
    }

    // Initiate data as empty array
    let data = []
    let sqlQuery = ''

    // only generate SQL Query if relevantNodeDocs is not empty
    if (relevantNodeDocs.length !== 0) {
      // Rerank: combine schema node docs first, prioritize top-N
      const candidateDocs = relevantNodeDocs.map((d) => ({ id: String(d.id), text: d.document_text }))
      const reranked = await rerankDocuments(newQuery, candidateDocs, { topN: Math.min(20, candidateDocs.length) })
      const relevantNodeDocsText = reranked.map((r) => r.text)
      /**
      * GENERATE SQL AGENT
      * Generate SQL query using the relevant documents
      */
      sqlQuery = await generateSQLQuery(newQuery, relevantNodeDocsText)

      // Execute it and store into data
      try {
        data = await executeSQLQuery(sqlQuery, projectId)
      } catch (executionError) {
      
        const errorMessage = executionError instanceof Error ? executionError.message : 'Unknown error'

        const ragAnswer = await generateAnswer(`${newQuery} (Fallback to RAG)`, [], 
          [
            `SQL execution failed: ${errorMessage}`,
            `Generated SQL Query: ${sqlQuery}`,
            ...relevantMinioDocs.map((r) => r.document_text)
          ]
        )
        // assistant
        await saveChatHistoryToDB({
          role: 'assistant',
          projectId,
          userId: user.id,
          content: ragAnswer,
          sqlQuery,
          ragNodeDocuments: relevantNodeDocs,
          ragMinioDocuments: relevantMinioDocs,
          improvedPrompt: null,
          data: [],
          timestamp: new Date()
        })

        return NextResponse.json({ status: 'success' })
      }
    }

    /**
     * SUMMARIZATION AGENT
     * Combine improved user query, data from excecuted SQL, and context from RAG Minio
     */
    const answer = await generateAnswer(newQuery, data, relevantMinioDocs.map((r) => r.document_text))

    // assistant
    await saveChatHistoryToDB({
      role: 'assistant',
      projectId,
      userId: user.id,
      content: answer,
      sqlQuery,
      ragNodeDocuments: relevantNodeDocs,
      ragMinioDocuments: relevantMinioDocs,
      improvedPrompt: null,
      data,
      timestamp: new Date()
    })

    return NextResponse.json({ status: 'success' })

  } catch (error) {
    console.error('Error in search API:', error)

    return createErrorResponse(
      'Failed to process search query',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
