import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { getCurrentUser } from '@/lib/auth'
// import { repromptQuery } from './_utils/reprompt-query-agent'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { MinioDocMatch, NodeDocMatch, SearchRequest, SumObj } from './_utils/types'
import { createErrorResponse } from './_utils/response-handler'
import { saveChatHistoryToDB } from './_utils/chat-history-utils'
import { generateQueryEmbedding } from './_utils/generate-embedding-agent'
import { generateSQLQuery } from './_utils/generate-sql-agent'
import { executeSQLQuery } from './_utils/sql-utils'
import { rerankDocuments } from './_utils/rerank'
import { generateAnswer } from './_utils/summarization-agent'
import { cacheGetOrSet, sha256 } from './_utils/cache'
import { saveSemanticMemory, retrieveEpisodicMemory, logProcedure } from './_utils/memory'
import { costUsdFor } from './_utils/pricing'

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser()
    if (!user?.email) {
      return createErrorResponse('Authentication required', undefined, 401)
    }

    // Load user config from database
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    const userConfig = (dbUser?.config as any) || {}

    const body: SearchRequest = await request.json()
    // Keep the original destructure but do not rely on env defaults here
    const {
      query,
      min_cosine: min_cosine_raw,
      top_k: top_k_raw,
      projectId,
      timestamp = new Date(),
      use_hybrid: use_hybrid_raw,
      hybrid_alpha: hybrid_alpha_raw,
      location = { district: [], province: [] }
    } = body

    // Priority: request param > user config > env var fallback
    const min_cosine = typeof min_cosine_raw === 'number'
      ? min_cosine_raw
      : Number(min_cosine_raw ?? userConfig.hybridMinCosine ?? process.env.HYBRID_MIN_COSINE ?? 0.2)

    const top_k = typeof top_k_raw === 'number'
      ? top_k_raw
      : Number(top_k_raw ?? userConfig.hybridTopK ?? process.env.HYBRID_TOP_K ?? 5)

    const use_hybrid = typeof use_hybrid_raw === 'boolean'
      ? use_hybrid_raw
      : typeof use_hybrid_raw === 'undefined'
        ? (userConfig.useHybridSearch ?? (process.env.USE_HYBRID_SEARCH ?? 'true').toLowerCase() !== 'false')
        : use_hybrid_raw

    const hybrid_alpha = typeof hybrid_alpha_raw === 'number'
      ? hybrid_alpha_raw
      : Number(hybrid_alpha_raw ?? userConfig.hybridAlpha ?? process.env.HYBRID_ALPHA ?? 0.7)

    // Memory feature flags
    const MEM_SEMANTIC_WRITE_ENABLED = (process.env.MEM_SEMANTIC_WRITE_ENABLED ?? 'true').toLowerCase() !== 'false'
    const MEM_EPISODIC_ENABLED = (process.env.MEM_EPISODIC_ENABLED ?? 'true').toLowerCase() !== 'false'
    const MEM_PROCEDURAL_ENABLED = (process.env.MEM_PROCEDURAL_ENABLED ?? 'true').toLowerCase() !== 'false'
    const EPISODIC_TOPK = Number(process.env.EPISODIC_TOPK ?? 6)

    // Now validations work with numbers/booleans
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
    const sqlModelForCache = (userConfig.sqlGeneratorAgentModel ?? process.env.SQL_GENERATOR_AGENT_MODEL) || 'gpt'
    const embKey = `emb:v1:${sqlModelForCache}:${sha256(newQuery)}`
    const embeddingModelForEmbedding = userConfig.embeddingAgentModel ?? process.env.EMBEDDING_AGENT_MODEL ?? "text-embedding-3-large"
    const queryEmbedding = await cacheGetOrSet(embKey, 60 * 60 * 24 * 30, async () => {
      return await generateQueryEmbedding(newQuery, embeddingModelForEmbedding)
    })
    const embeddingStr = JSON.stringify(queryEmbedding);

    // Episodic memory: recent chat snippets
    const episodicSnippets: string[] = MEM_EPISODIC_ENABLED
      ? await retrieveEpisodicMemory({ userId: user.id, projectId, topK: EPISODIC_TOPK })
      : []

    // Semantic cache: retrieve top semantic facts from mem_semantic and cache them short-term
    // Priority: user config > env var fallback
    const TTL_SEMRETR = userConfig.cacheTtlSemretr ?? Number(process.env.CACHE_TTL_SEMRETR ?? 60 * 30)
    const semTopK = userConfig.semanticTopK ?? Number(process.env.SEMANTIC_TOPK ?? 8)
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
      // Priority: user config > env var fallback
      const rerankEnabled = userConfig.rerankEnabled ?? (process.env.RERANK_ENABLED ?? 'true').toLowerCase() !== 'false'
      const candidateDocs = relevantNodeDocs.map((d) => ({ id: String(d.id), text: d.document_text }))
      let relevantNodeDocsText: string[]
      if (rerankEnabled) {
        const topN = Math.min(userConfig.rerankTopN ?? Number(process.env.RERANK_TOPN ?? 20), candidateDocs.length)
        const rerankModelName = (userConfig.rerankModelName ?? process.env.RERANK_MODEL_NAME) || 'cross-encoder/ms-marco-MiniLM-L-6-v2'
        const rrKey = `rr:v1:${rerankModelName}:${sha256(newQuery)}:${topN}`
        const reranked = await cacheGetOrSet(rrKey, Number(process.env.CACHE_TTL_RERANK ?? 60 * 20), async () => (
          await rerankDocuments(newQuery, candidateDocs, { topN, model: rerankModelName })
        ))
        relevantNodeDocsText = reranked.map((r) => r.text)
      } else {
        relevantNodeDocsText = candidateDocs.map(c => c.text)
      }

      // Prepend episodic (chat history) and semantic snippets to boost grounding
      relevantNodeDocsText = [
        ...episodicSnippets,
        ...semanticSnippets,
        ...relevantNodeDocsText
      ].slice(0, Math.min(24, episodicSnippets.length + semanticSnippets.length + relevantNodeDocsText.length))
      /**
      * GENERATE SQL AGENT
      * Generate SQL query using the relevant documents
      */
      const sqlKey = `sqlgen:v1:${projectId}:${sha256(newQuery + '|' + relevantNodeDocsText.join('\n').slice(0, 4000))}`

      const sqlModelForGen = userConfig.sqlGeneratorAgentModel ?? process.env.SQL_GENERATOR_AGENT_MODEL ?? "gpt-4o"
      const sqlGenRes = await cacheGetOrSet(sqlKey, 60 * 60 * 12, async () => (
        await generateSQLQuery(newQuery, relevantNodeDocsText, sqlModelForGen)
      ))
      sqlQuery = sqlGenRes.sql
      const sqlUsage = sqlGenRes.usage

      // Execute it and store into data
      try {
        const sqlResKey = `sqlres:v1:${projectId}:${sha256(sqlQuery)}`
        data = await cacheGetOrSet(sqlResKey, 60 * 30, async () => (
          await executeSQLQuery(sqlQuery, projectId)
        ))
      } catch (executionError) {
      
        const errorMessage = executionError instanceof Error ? executionError.message : 'Unknown error'

        const ragRes = await generateAnswer(`${newQuery} (Fallback to RAG)`, [], 
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
          content: ragRes.text,
          sqlQuery,
          ragNodeDocuments: relevantNodeDocs,
          ragMinioDocuments: relevantMinioDocs,
          improvedPrompt: JSON.stringify({ tokenUsage: { sql: sqlUsage ?? null, summarize: ragRes.usage, total: (sqlUsage?.total ?? 0) + (ragRes.usage?.total ?? 0) } }),
          data: [],
          timestamp: new Date()
        })

        // Include tokenUsage in API response
        const embUsage = { prompt: Math.ceil(newQuery.length / 4), completion: 0, total: Math.ceil(newQuery.length / 4), source: 'estimated' as const }
        const combinedUsage = {
          embedding: embUsage,
          sql: sqlUsage ?? null,
          summarize: ragRes.usage,
          total: embUsage.total + (sqlUsage?.total ?? 0) + (ragRes.usage?.total ?? 0)
        }
        // Cost calculation (USD) using OPENAI_PRICES map and user config models
        const embeddingModel = userConfig.embeddingAgentModel ?? process.env.EMBEDDING_AGENT_MODEL
        const sqlModel = userConfig.sqlGeneratorAgentModel ?? process.env.SQL_GENERATOR_AGENT_MODEL
        const sumModel = userConfig.summarizationModel ?? process.env.SUMMARIZATION_MODEL
        const embUsd = costUsdFor(embeddingModel, embUsage.prompt, 0)
        const sqlUsd = costUsdFor(sqlModel, (sqlUsage?.prompt ?? 0), (sqlUsage?.completion ?? 0))
        const sumUsd = costUsdFor(sumModel, (ragRes.usage?.prompt ?? 0), (ragRes.usage?.completion ?? 0))
        const combinedCost = { embeddingUsd: embUsd, sqlUsd, summarizeUsd: sumUsd, totalUsd: embUsd + sqlUsd + sumUsd }
        return NextResponse.json({ status: 'success', tokenUsage: combinedUsage, tokenCost: combinedCost })
      }
    }

    /**
     * SUMMARIZATION AGENT
     * Combine improved user query, data from excecuted SQL, and context from RAG Minio
     */
    const ctxDocs = [
      // Use MinIO RAG docs plus memory snippets as extra context
      ...relevantMinioDocs.map((r) => r.document_text),
      ...semanticSnippets,
      ...episodicSnippets
    ]
    // bump cache namespace to avoid legacy string payloads
    const sumModelForCache = (userConfig.summarizationModel ?? process.env.SUMMARIZATION_MODEL) || 'SeaLLM'
    const sumKey = `sum:v2:${sumModelForCache}:${sha256(newQuery + '|' + JSON.stringify(data).slice(0, 4000) + '|' + sha256(ctxDocs.join('\n').slice(0, 4000)))}`
    const summarizationEndpoint = (userConfig.summarizationModelEndpoint ?? process.env.SUMMARIZATION_MODEL_ENDPOINT) || ''
    const summarizationModelForGen = (userConfig.summarizationModel ?? process.env.SUMMARIZATION_MODEL) || ''
    const sumRes2 = await cacheGetOrSet(sumKey, 60 * 20, async () => (
      await generateAnswer(newQuery, data, ctxDocs, summarizationEndpoint, summarizationModelForGen)
    ))

    const sumAny: any = sumRes2 as any
    const sumObj: SumObj = (typeof sumAny === 'string')
      ? { text: sumAny as string, usage: { prompt: 0, completion: Math.ceil((sumAny as string).length / 4), total: Math.ceil((sumAny as string).length / 4), source: 'estimated' } }
      : (sumAny as SumObj)
    const answer = sumObj.text

    // Semantic memory write-back: store compact fact for future retrieval
    if (MEM_SEMANTIC_WRITE_ENABLED) {
      const toStore = `${newQuery} — ${answer.slice(0, 1500)}`
      await saveSemanticMemory({ userId: user.id, projectId, content: toStore, tags: ['answer','auto'] })
    }

    // assistant
    await saveChatHistoryToDB({
      role: 'assistant',
      projectId,
      userId: user.id,
      content: answer,
      sqlQuery,
      ragNodeDocuments: relevantNodeDocs,
      ragMinioDocuments: relevantMinioDocs,
      improvedPrompt: JSON.stringify({ tokenUsage: { sql: null, summarize: sumObj.usage, total: sumObj.usage.total } }),
      data,
      timestamp: new Date()
    })

    // Procedural memory logging: record the flow and decisions
    if (MEM_PROCEDURAL_ENABLED) {
      await logProcedure({
        userId: user.id,
        projectId,
        name: 'search_pipeline_v1',
        details: {
          use_hybrid,
          hybrid_alpha,
          min_cosine,
          top_k,
          rerankEnabled: userConfig.rerankEnabled ?? (process.env.RERANK_ENABLED ?? 'true').toLowerCase() !== 'false',
          semanticSnippets: semanticSnippets.length,
          episodicSnippets: episodicSnippets.length,
          nodeDocs: (typeof relevantNodeDocs !== 'undefined') ? relevantNodeDocs.length : 0,
          minioDocs: (typeof relevantMinioDocs !== 'undefined') ? relevantMinioDocs.length : 0,
          hadSql: Boolean(sqlQuery),
          dataRows: Array.isArray(data) ? data.length : 0
        }
      })
    }

    // Include tokenUsage in API response
    const embUsage = { prompt: Math.ceil(newQuery.length / 4), completion: 0, total: Math.ceil(newQuery.length / 4), source: 'estimated' as const }
    const combinedUsage = {
      embedding: embUsage,
      sql: null,
      summarize: sumObj.usage,
      total: embUsage.total + sumObj.usage.total
    }
    // Cost calculation (USD) using OPENAI_PRICES map and user config models
    const embeddingModel = userConfig.embeddingAgentModel ?? process.env.EMBEDDING_AGENT_MODEL
    const sumModel = userConfig.summarizationModel ?? process.env.SUMMARIZATION_MODEL
    const embUsd = costUsdFor(embeddingModel, embUsage.prompt, 0)
    const sqlUsd = 0
    const sumUsd = costUsdFor(sumModel, (sumObj.usage?.prompt ?? 0), (sumObj.usage?.completion ?? 0))
    const combinedCost = { embeddingUsd: embUsd, sqlUsd, summarizeUsd: sumUsd, totalUsd: embUsd + sqlUsd + sumUsd }
    return NextResponse.json({ status: 'success', tokenUsage: combinedUsage, tokenCost: combinedCost })

  } catch (error) {
    console.error('Error in search API:', error)

    return createErrorResponse(
      'Failed to process search query',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
