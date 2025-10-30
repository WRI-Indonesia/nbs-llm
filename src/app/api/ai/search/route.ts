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
import { cacheGetOrSet, sha256 } from './_utils/cache'

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
      min_cosine = process.env.HYBRID_MIN_COSINE || 0.2, 
      top_k = process.env.HYBRID_TOP_K || 5, 
      projectId, 
      location = { district: [], province: [] }, 
      timestamp = new Date(),
      use_hybrid = process.env.USE_HYBRID_SEARCH || 'true',  // Default to hybrid search
      hybrid_alpha = process.env.HYBRID_ALPHA || 0.7  // Default 70% vector, 30% keyword
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
    const embKey = `emb:v1:${process.env.SQL_GENERATOR_AGENT_MODEL || 'gpt'}:${sha256(newQuery)}`
    const queryEmbedding = await cacheGetOrSet(embKey, 60 * 60 * 24 * 30, async () => {
      return await generateQueryEmbedding(newQuery)
    })
    const embeddingStr = JSON.stringify(queryEmbedding);

    // Semantic cache: retrieve top semantic facts from mem_semantic and cache them short-term
    const TTL_SEMRETR = Number(process.env.CACHE_TTL_SEMRETR ?? 60 * 30)
    const semTopK = Number(process.env.SEMANTIC_TOPK ?? 8)
    const semKey = `semretr:v1:${projectId}:${sha256(newQuery)}:${semTopK}`
    const semanticSnippets = await cacheGetOrSet(semKey, TTL_SEMRETR, async () => {
      try {
        const rows = await prisma.$queryRawUnsafe<{ content: string }[]>(
          `SELECT content FROM "mem_semantic" WHERE project_id = $1 ORDER BY embedding <-> ($2)::vector(3072) LIMIT ${semTopK}`,
          projectId,
          JSON.stringify(queryEmbedding)
        )
        return rows.map(r => r.content)
      } catch {
        return [] as string[]
      }
    })

    // Use hybrid search if enabled, otherwise fall back to pure vector search
    let relevantNodeDocs: NodeDocMatch[]
    let relevantMinioDocs: MinioDocMatch[]

    if (use_hybrid) {
      // Hybrid search: combines vector similarity with keyword search (BM25-like)
      const retrKeyNode = `retr:node:v1:${projectId}:${sha256(newQuery)}:${top_k}:${min_cosine}:${hybrid_alpha}`
      relevantNodeDocs = await cacheGetOrSet(retrKeyNode, 60 * 30, async () => (
        await prisma.$queryRaw<NodeDocMatch[]>(
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
      )
      ));

      const retrKeyMinio = `retr:minio:v1:${projectId}:${sha256(newQuery)}:${top_k}:${min_cosine}:${hybrid_alpha}`
      relevantMinioDocs = await cacheGetOrSet(retrKeyMinio, 60 * 30, async () => (
        await prisma.$queryRaw<MinioDocMatch[]>(
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
      )
      ));
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
    let data: any[] = []
    let sqlQuery = ''

    // only generate SQL Query if relevantNodeDocs is not empty
    if (relevantNodeDocs.length !== 0) {
      // Rerank: combine schema node docs first, prioritize top-N (guarded by flag)
      const rerankEnabled = (process.env.RERANK_ENABLED ?? 'true').toLowerCase() !== 'false'
      const candidateDocs = relevantNodeDocs.map((d) => ({ id: String(d.id), text: d.document_text }))
      let relevantNodeDocsText: string[]
      if (rerankEnabled) {
        const topN = Math.min(Number(process.env.RERANK_TOPN ?? 20), candidateDocs.length)
        const rrKey = `rr:v1:${process.env.RERANK_MODEL_NAME || 'cross-encoder/ms-marco-MiniLM-L-6-v2'}:${sha256(newQuery)}:${topN}`
        const reranked = await cacheGetOrSet(rrKey, Number(process.env.CACHE_TTL_RERANK ?? 60 * 20), async () => (
          await rerankDocuments(newQuery, candidateDocs, { topN })
        ))
        relevantNodeDocsText = reranked.map((r) => r.text)
      } else {
        relevantNodeDocsText = candidateDocs.map(c => c.text)
      }

      // Prepend semantic snippets (pgvector mem_semantic) to boost grounding
      relevantNodeDocsText = [
        ...semanticSnippets,
        ...relevantNodeDocsText
      ].slice(0, Math.min(20, semanticSnippets.length + relevantNodeDocsText.length))
      /**
      * GENERATE SQL AGENT
      * Generate SQL query using the relevant documents
      */
      const sqlKey = `sqlgen:v1:${projectId}:${sha256(newQuery + '|' + relevantNodeDocsText.join('\n').slice(0, 4000))}`
      sqlQuery = await cacheGetOrSet(sqlKey, 60 * 60 * 12, async () => (
        await generateSQLQuery(newQuery, relevantNodeDocsText)
      ))

      // Execute it and store into data
      try {
        const sqlResKey = `sqlres:v1:${projectId}:${sha256(sqlQuery)}`
        data = await cacheGetOrSet(sqlResKey, 60 * 30, async () => (
          await executeSQLQuery(sqlQuery, projectId)
        ))
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
    const ctxDocs = relevantMinioDocs.map((r) => r.document_text)
    const sumKey = `sum:v1:${process.env.SUMMARIZATION_MODEL || 'SeaLLM'}:${sha256(newQuery + '|' + JSON.stringify(data).slice(0, 4000) + '|' + sha256(ctxDocs.join('\n').slice(0, 4000)))}`
    const answer = await cacheGetOrSet(sumKey, 60 * 20, async () => (
      await generateAnswer(newQuery, data, ctxDocs)
    ))

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
