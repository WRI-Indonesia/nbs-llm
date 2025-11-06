import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { MinioDocMatch, NodeDocMatch, SearchRequest, SumObj } from './_utils/types'
import { createErrorResponse } from './_utils/response-handler'
import { saveChatHistoryToDB } from './_utils/chat-history-utils'
import { executeSQLQuery } from './_utils/sql-utils'
import { cacheGetOrSet, cacheGet, sha256 } from './_utils/cache'
import { costUsdFor } from './_utils/pricing'
import {
  EmbeddingAgent,
  RerankAgent,
  SQLGenerationAgent,
  SummarizationAgent,
  MemoryAgent
} from './_agents'
import { UserConfig } from '@/types/user-config'

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser()
    if (!user?.email) {
      return createErrorResponse('Authentication required', undefined, 401)
    }

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
      storeInDB = true  // Default to true if not specified
    } = body

    // Verify user exists in database and get user config
    let dbUser: any = await prisma.user.findUnique({ where: { id: user.id } })
    
    // If user doesn't exist by ID, try to find by email (session might have stale ID)
    if (!dbUser) {
      dbUser = await prisma.user.findUnique({ where: { email: user.email } })
      // If still not found, user doesn't exist - cannot proceed with database operations
      if (!dbUser) {
        console.error(`User not found in database: email=${user.email}, id=${user.id}`)
        // If storeInDB is false, we can still proceed without saving
        // Otherwise, return error
        if (storeInDB) {
          return createErrorResponse('User not found in database. Please sign in again.', undefined, 401)
        }
      }
    }
    
    // Use the verified user ID from database, or fallback to session user ID
    const verifiedUserId = dbUser?.id || user.id
    const userConfig = (dbUser?.config as UserConfig) || {}

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

    // save user chat into DB (only if storeInDB is true and user exists)
    if (storeInDB && dbUser) {
      await saveChatHistoryToDB({
        role: 'user',
        projectId,
        userId: verifiedUserId,
        content: query,
        sqlQuery: null,
        ragNodeDocuments: null,
        ragMinioDocuments: null,
        improvedPrompt: null,
        data: null,
        timestamp
      })
    }

    /**
     * TAKE OUT TEMPORARY!
     * 
     * RE-PROMPT QUERY AGENT
     * Re-prompt query to handle typo, .etc and improve user query to generate better SQL
     */
    // const repromtResult = await repromptQuery(query, location.district)
    // const newQuery = repromtResult.result
    // const newQuery = query

    // If prompt is unable to re-prompt it will return false
    // if (newQuery === 'false') {
    //   // assistant
    //   await saveChatHistoryToDB({
    //     role: 'assistant',
    //     projectId,
    //     userId: user.id,
    //     content: 'Please try to input your location in Zip File or choose any location on your query fisrt',
    //     sqlQuery: null,
    //     ragNodeDocuments: null,
    //     ragMinioDocuments: null,
    //     improvedPrompt: null,
    //     data: null,
    //     timestamp: new Date()
    //   })

    //   return NextResponse.json({ status: 'success' })
    // }

    /**
     * ====================================================================
     * EMBEDDING AGENT
     * ====================================================================
     * 
     * PURPOSE:
     * Converts the user's natural language query into a high-dimensional vector
     * representation (embedding) that captures semantic meaning. This enables
     * semantic similarity search in the database, allowing us to find relevant
     * documents even when they don't contain exact keyword matches.
     * 
     * WHY WE USE IT:
     * - Vector embeddings enable semantic understanding beyond keyword matching
     * - Allows finding similar queries from cache (semantic reuse)
     * - Powers vector similarity search in PostgreSQL (pgvector)
     * - Essential for retrieving relevant schema documents and MinIO documents
     * 
     * HOW IT WORKS:
     * Uses OpenAI's text-embedding-3-large model (3072 dimensions) to convert
     * text into a numerical vector where semantically similar texts have vectors
     * that are close together in the embedding space (measured by cosine similarity).
     * 
     * EXAMPLE INPUT:
     *   Query: "Show me species data for Berau district"
     * 
     * EXAMPLE OUTPUT:
     *   {
     *     embedding: [0.0123, -0.0456, 0.0789, ..., 0.0234], // 3072 numbers
     *     model: "text-embedding-3-large"
     *   }
     * 
     * USE CASES:
     * 1. Semantic cache lookup - find if similar query was asked before
     * 2. Vector search - find relevant schema documents (node_docs table)
     * 3. Vector search - find relevant MinIO documents (minio_docs table)
     * 4. Semantic memory retrieval - find relevant facts from past queries
     */
    const embeddingAgent = new EmbeddingAgent()
    const sqlModelForCache = userConfig.sqlGeneratorAgentModel ?? 'gpt-4o'
    const embKey = `emb:v1:${sqlModelForCache}:${sha256(query)}`
    const embeddingModelForEmbedding = userConfig.embeddingAgentModel ?? "text-embedding-3-large"
    const embeddingResult = await cacheGetOrSet(embKey, 60 * 60 * 24 * 30, async () => {
      return await embeddingAgent.execute(query, embeddingModelForEmbedding)
    })
    const queryEmbedding = embeddingResult.embedding
    const embeddingStr = JSON.stringify(queryEmbedding);

    // -------------------- Semantic reuse (recent queries) --------------------
    function cosineSim(a: number[], b: number[]): number {
      let dot = 0, na = 0, nb = 0
      const len = Math.min(a.length, b.length)
      for (let i = 0; i < len; i++) { const x = a[i] || 0, y = b[i] || 0; dot += x * y; na += x * x; nb += y * y }
      const denom = Math.sqrt(na) * Math.sqrt(nb)
      return denom === 0 ? 0 : dot / denom
    }
    type RecentEntry = { emb: number[]; sql?: string; data?: any[]; sum?: { text: string; usage?: any }; ts: number }
    const RECENT_KEY = `recentq:v1:${projectId}`
    const REUSE_SIM = Number(process.env.SEMANTIC_REUSE_SIM ?? 0.93)
    // const RECENT_TTL = Number(process.env.RECENT_QUERIES_TTL ?? 60 * 60 * 6)
    // const RECENT_MAX = Number(process.env.RECENT_QUERIES_MAX_SIZE ?? 20)
    try {
      const list = (await cacheGet<RecentEntry[]>(RECENT_KEY)) || []
      let best: RecentEntry | null = null
      let bestSim = 0
      for (const r of list) {
        if (!Array.isArray(r.emb)) continue
        const sim = cosineSim(queryEmbedding as number[], r.emb)
        if (sim > bestSim) { bestSim = sim; best = r }
      }
      if (best && bestSim >= REUSE_SIM && best.sum?.text) {
        const embTokens = Math.ceil(query.length / 4)
        const embUsage = { prompt: embTokens, completion: 0, total: embTokens, source: 'estimated' as const }
        const embeddingModel = userConfig.embeddingAgentModel ?? process.env.EMBEDDING_AGENT_MODEL
        const embUsd = costUsdFor(embeddingModel, embTokens, 0)
        const tokenUsage = { embedding: embUsage, sql: null, summarize: { prompt: 0, completion: 0, total: 0, source: 'estimated' as const }, total: embTokens }
        const tokenCost = { embeddingUsd: embUsd, sqlUsd: 0, summarizeUsd: 0, totalUsd: embUsd }
        const response: any = { 
          status: 'success', 
          reused: true, 
          answer: best.sum.text, 
          sqlQuery: best.sql ?? null, 
          data: best.data ?? [], 
          tokenUsage, 
          tokenCost 
        }
        if (!storeInDB) {
          response.agentResults = {
            embedding: {
              model: embeddingModelForEmbedding,
              usage: embUsage
            },
            reused: true,
            reusedSimilarity: bestSim
          }
        }
        return NextResponse.json(response)
      }
    } catch { }

    /**
     * ====================================================================
     * MEMORY AGENT - Episodic Memory Retrieval
     * ====================================================================
     * 
     * PURPOSE:
     * Retrieves recent chat history snippets to provide context from the
     * current conversation session. This helps maintain conversational continuity
     * and allows the system to reference previous queries/responses.
     * 
     * WHY WE USE IT:
     * - Provides conversational context (e.g., "What about the previous district?")
     * - Helps SQL generation agent understand follow-up questions
     * - Improves answer quality by grounding in conversation history
     * - Enables multi-turn conversations without explicit context passing
     * 
     * HOW IT WORKS:
     * Retrieves the most recent N chat messages (user + assistant pairs) from
     * the chat_history table, ordered by timestamp. Returns compact summaries
     * in format "role: content".
     * 
     * EXAMPLE INPUT:
     *   { userId: "user123", projectId: "proj456", topK: 6 }
     * 
     * EXAMPLE OUTPUT:
     *   [
     *     "user: Show me species in Berau",
     *     "assistant: Berau has 150 mammal species...",
     *     "user: What about reptiles?",
     *     "assistant: Berau has 45 reptile species..."
     *   ]
     * 
     * USE CASE:
     * These snippets are prepended to the SQL generation context, allowing the
     * agent to understand references like "the previous query" or "that district".
     */
    const memoryAgent = new MemoryAgent()
    const episodicSnippets: string[] = MEM_EPISODIC_ENABLED && dbUser
      ? await memoryAgent.retrieveEpisodicMemory({ userId: verifiedUserId, projectId, topK: EPISODIC_TOPK })
      : []

    /**
     * ====================================================================
     * MEMORY AGENT - Semantic Memory Retrieval
     * ====================================================================
     * 
     * PURPOSE:
     * Retrieves semantically similar facts/knowledge from past queries stored
     * in semantic memory. This enables the system to leverage learned information
     * from previous interactions, even if the current query is phrased differently.
     * 
     * WHY WE USE IT:
     * - Reuses knowledge from past successful queries
     * - Provides factual context that improves SQL generation accuracy
     * - Helps answer questions about previously discussed topics
     * - Reduces redundant processing by leveraging stored knowledge
     * 
     * HOW IT WORKS:
     * Uses vector similarity search (cosine distance) on the mem_semantic table
     * to find facts with embeddings similar to the current query embedding.
     * Results are then re-ranked using a composite score (70% semantic similarity,
     * 30% lexical Jaccard) and filtered with MMR (Maximal Marginal Relevance) to
     * ensure diversity and avoid near-duplicates.
     * 
     * EXAMPLE INPUT:
     *   Query: "What species are in Berau?"
     *   Query Embedding: [0.0123, -0.0456, ..., 0.0234]
     * 
     * EXAMPLE OUTPUT (after MMR filtering):
     *   [
     *     "Episode: Show species in Berau — Berau district has 150 mammal species...",
     *     "Episode: Berau biodiversity — Total species count: 245 including birds...",
     *     "Episode: Compare Berau vs Nunukan — Berau has higher mammal diversity..."
     *   ]
     * 
     * USE CASE:
     * These semantic snippets are combined with episodic memory and schema documents
     * to provide rich context for SQL generation, helping the agent understand
     * domain-specific patterns and relationships.
     */
    // Semantic cache: retrieve top semantic facts from mem_semantic and cache them short-term
    // Priority: user config > env var fallback
    const TTL_SEMRETR = userConfig.cacheTtlSemretr ?? (60 * 30)
    const semTopK = userConfig.semanticTopK ?? 8
    const semKey = `semretr:v2:${projectId}:${sha256(query)}:${semTopK}`
    const semanticRows = await cacheGetOrSet(semKey, TTL_SEMRETR, async () => {
      try {
        const limit = Math.max(semTopK * 3, semTopK)
        const rows = await prisma.$queryRawUnsafe<{ id: string, content: string, sim: number }[]>(
          `SELECT id, content, 1 - (embedding <-> ($2)::vector(3072)) AS sim
           FROM "mem_semantic"
           WHERE project_id = $1
           ORDER BY embedding <-> ($2)::vector(3072)
           LIMIT ${limit}`,
          projectId,
          JSON.stringify(queryEmbedding)
        )
        return rows
      } catch {
        return [] as { id: string, content: string, sim: number }[]
      }
    })

    // Composite score + simple MMR over semanticRows
    const queryTokens = new Set((query.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 2))
    function jaccard(a: Set<string>, b: Set<string>): number {
      let inter = 0
      for (const t of a) if (b.has(t)) inter++
      const union = a.size + b.size - inter
      return union === 0 ? 0 : inter / union
    }
    const scored = semanticRows.map(r => {
      const toks = new Set((r.content.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 2))
      const lex = jaccard(queryTokens, toks)
      const score = 0.7 * (Number(r.sim || 0)) + 0.3 * lex
      return { ...r, toks, lex, score }
    }).sort((a, b) => b.score - a.score)

    const mmrLambda = 0.5
    const selected: { id: string, content: string }[] = []
    const selectedToks: Set<string>[] = []
    for (const cand of scored) {
      const diversityPenalty = selectedToks.length
        ? Math.max(...selectedToks.map(st => jaccard(st, cand.toks)))
        : 0
      const mmrScore = cand.score - mmrLambda * diversityPenalty
        ; (cand as any).mmrScore = mmrScore
    }
    scored.sort((a, b) => (b as any).mmrScore - (a as any).mmrScore)
    for (const cand of scored) {
      if (selected.length >= semTopK) break
      // Avoid near-duplicate by lexical Jaccard
      const tooClose = selectedToks.some(st => jaccard(st, cand.toks) > 0.85)
      if (tooClose) continue
      selected.push({ id: cand.id, content: cand.content })
      selectedToks.push(cand.toks)
    }
    const semanticSnippets = selected.map(s => s.content)
    const chosenSemanticIds = selected.map(s => s.id)

    // Use hybrid search if enabled, otherwise fall back to pure vector search
    let relevantNodeDocs: NodeDocMatch[]
    let relevantMinioDocs: MinioDocMatch[]

    if (use_hybrid) {
      // Hybrid search: combines vector similarity with keyword search (BM25-like)
      const retrKeyNode = `retr:node:v1:${projectId}:${sha256(query)}:${top_k}:${min_cosine}:${hybrid_alpha}`
      relevantNodeDocs = await cacheGetOrSet(retrKeyNode, 60 * 30, async () => (
        await prisma.$queryRaw<NodeDocMatch[]>(
          Prisma.sql`
        SELECT 
          * FROM 
          match_node_docs_hybrid(
            ${query}::TEXT,
            ${embeddingStr}::TEXT,
            ${top_k}::INT,         
            ${min_cosine}::FLOAT,
            NULL,  -- node_id_filter
            ${hybrid_alpha}::FLOAT
          );
      `
        )
      ));

      const retrKeyMinio = `retr:minio:v1:${projectId}:${sha256(query)}:${top_k}:${min_cosine}:${hybrid_alpha}`
      relevantMinioDocs = await cacheGetOrSet(retrKeyMinio, 60 * 30, async () => (
        await prisma.$queryRaw<MinioDocMatch[]>(
          Prisma.sql`
        SELECT 
          * FROM 
          match_minio_docs_hybrid(
            ${query}::TEXT,
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
    let sqlUsage: any = null
    let rerankResults: any[] | null = null

    // only generate SQL Query if relevantNodeDocs is not empty
    if (relevantNodeDocs.length !== 0) {
      /**
       * ====================================================================
       * RERANK AGENT
       * ====================================================================
       * 
       * PURPOSE:
       * Re-ranks retrieved schema documents using a cross-encoder model to improve
       * relevance ordering. While initial retrieval uses vector similarity, reranking
       * uses a more sophisticated model that considers query-document pairs together,
       * resulting in better relevance scoring.
       * 
       * WHY WE USE IT:
       * - Initial vector search may retrieve documents that are semantically similar
       *   but not actually relevant to the specific query intent
       * - Cross-encoder models (like ms-marco-MiniLM-L-6-v2) provide better relevance
       *   scoring by jointly encoding query and document
       * - Improves SQL generation quality by ensuring the most relevant schema
       *   information is prioritized
       * - Reduces token usage by focusing on top-N most relevant documents
       * 
       * HOW IT WORKS:
       * Uses HuggingFace's cross-encoder models to score each query-document pair.
       * The model processes both query and document together, allowing it to capture
       * nuanced relevance signals that bi-encoder (embedding) models might miss.
       * Documents are then sorted by score and top-N are selected.
       * 
       * EXAMPLE INPUT:
       *   Query: "Show me species data for Berau district"
       *   Documents: [
       *     { id: "1", text: "Table: species_data; Column: district_name; Type: VARCHAR" },
       *     { id: "2", text: "Table: species_data; Column: mammal_count; Type: INTEGER" },
       *     { id: "3", text: "Table: locations; Column: province_name; Type: VARCHAR" },
       *     ...
       *   ]
       * 
       * EXAMPLE OUTPUT:
       *   [
       *     { id: "1", text: "...", score: 0.95 },  // Most relevant (district_name)
       *     { id: "2", text: "...", score: 0.87 },  // Relevant (mammal_count)
       *     { id: "3", text: "...", score: 0.23 }, // Less relevant (province_name)
       *     ...
       *   ]
       * 
       * USE CASE:
       * After initial vector/hybrid search retrieves candidate documents, reranking
       * ensures that documents most relevant to the specific query are prioritized
       * before being passed to the SQL generation agent. This significantly improves
       * SQL accuracy and reduces hallucination.
       */
      const rerankAgent = new RerankAgent()
      const rerankEnabled = userConfig.rerankEnabled ?? (process.env.RERANK_ENABLED ?? 'true').toLowerCase() !== 'false'
      const candidateDocs = relevantNodeDocs.map((d) => ({ id: String(d.id), text: d.document_text }))
      let relevantNodeDocsText: string[]
      if (rerankEnabled) {
        const topN = Math.min(userConfig.rerankTopN ?? Number(process.env.RERANK_TOPN ?? 20), candidateDocs.length)
        const rerankModelName = (userConfig.rerankModelName ?? process.env.RERANK_MODEL_NAME) || 'cross-encoder/ms-marco-MiniLM-L-6-v2'
        const rrKey = `rr:v1:${rerankModelName}:${sha256(query)}:${topN}`
        const reranked = await cacheGetOrSet(rrKey, Number(process.env.CACHE_TTL_RERANK ?? 60 * 20), async () => (
          await rerankAgent.execute(query, candidateDocs, { topN, model: rerankModelName })
        ))
        rerankResults = reranked
        relevantNodeDocsText = reranked.map((r) => r.text)
      } else {
        rerankResults = null
        relevantNodeDocsText = candidateDocs.map(c => c.text)
      }

      // Build a structured memory pack for explicit reasoning
      const constraints: string[] = []
      if (/compare|versus|vs\b/i.test(query)) constraints.push('Task: comparison requested')
      const facts = semanticSnippets.slice(0, semTopK).map(s => `- ${s.trim().slice(0, 220)}`)
      const memoryPack = [
        constraints.length ? 'CONSTRAINTS:' : '',
        ...constraints,
        'MEM-FACTS:',
        ...facts
      ].filter(Boolean).join('\n')

      // Prepend memory pack, episodic, and semantic snippets to boost grounding
      relevantNodeDocsText = [
        memoryPack,
        ...episodicSnippets,
        ...semanticSnippets,
        ...relevantNodeDocsText
      ].slice(0, Math.min(28, 1 + episodicSnippets.length + semanticSnippets.length + relevantNodeDocsText.length))
      /**
       * ====================================================================
       * SQL GENERATION AGENT
       * ====================================================================
       * 
       * PURPOSE:
       * Converts natural language queries into executable SQL queries by leveraging
       * retrieved schema documents, memory context, and domain knowledge. This is
       * the core intelligence that enables users to query databases using natural
       * language instead of SQL.
       * 
       * WHY WE USE IT:
       * - Enables non-technical users to query databases using natural language
       * - Leverages LLM understanding of schema relationships and SQL best practices
       * - Incorporates context from memory (episodic + semantic) for better accuracy
       * - Handles complex queries involving JOINs, aggregations, and filters
       * - Generates PostgreSQL-compliant SQL with proper error handling
       * 
       * HOW IT WORKS:
       * Uses GPT-4o (or configured model) with a carefully crafted prompt that includes:
       * 1. User's natural language query
       * 2. Relevant schema documents (tables, columns, types, relationships)
       * 3. Memory context (episodic snippets + semantic facts)
       * 4. Constraints and task hints (e.g., "comparison requested")
       * 5. SQL generation rules (COALESCE for NULLs, ILIKE for text, etc.)
       * 
       * The agent generates raw SQL (no markdown) that can be directly executed.
       * 
       * EXAMPLE INPUT:
       *   Query: "Show me species data for Berau district"
       *   Schema Documents: [
       *     "Table: species_data; Column: district_name; Type: VARCHAR; Description: Name of district",
       *     "Table: species_data; Column: mammal_count; Type: INTEGER; Description: Number of mammal species",
       *     "Table: species_data; Column: reptile_count; Type: INTEGER",
       *     ...
       *   ]
       *   Memory Context: [
       *     "CONSTRAINTS:\nTask: comparison requested",
       *     "MEM-FACTS:\n- Episode: Show species in Berau — Berau has 150 mammal species...",
       *     "user: What about reptiles?\nassistant: Berau has 45 reptile species..."
       *   ]
       * 
       * EXAMPLE OUTPUT:
       *   {
       *     sql: 'SELECT "district_name", "mammal_count", "reptile_count", "bird_count" FROM "species_data" WHERE "district_name" ILIKE \'%Berau%\' LIMIT 10',
       *     usage: {
       *       prompt: 1250,
       *       completion: 85,
       *       total: 1335,
       *       source: 'measured'
       *     }
       *   }
       * 
       * USE CASE:
       * The generated SQL is executed against the project's schema-specific database.
       * If execution fails, the system falls back to RAG-based answer generation using
       * MinIO documents and the error message.
       */
      const sqlGenerationAgent = new SQLGenerationAgent()
      const sqlKey = `sqlgen:v1:${projectId}:${sha256(query + '|' + relevantNodeDocsText.join('\n').slice(0, 4000))}`

      const sqlModelForGen = userConfig.sqlGeneratorAgentModel ?? process.env.SQL_GENERATOR_AGENT_MODEL ?? "gpt-4o"
      const sqlGenRes = await cacheGetOrSet(sqlKey, 60 * 60 * 12, async () => (
        await sqlGenerationAgent.execute(query, relevantNodeDocsText, sqlModelForGen)
      ))
      sqlQuery = sqlGenRes.sql
      sqlUsage = sqlGenRes.usage

      // Execute it and store into data
      try {
        const sqlResKey = `sqlres:v1:${projectId}:${sha256(sqlQuery)}`
        data = await cacheGetOrSet(sqlResKey, 60 * 30, async () => (
          await executeSQLQuery(sqlQuery, projectId)
        ))
      } catch (executionError) {

        const errorMessage = executionError instanceof Error ? executionError.message : 'Unknown error'

        /**
         * ====================================================================
         * SUMMARIZATION AGENT (Fallback Mode - SQL Execution Failed)
         * ====================================================================
         * 
         * PURPOSE:
         * When SQL execution fails, this agent generates a helpful response using
         * RAG (Retrieval-Augmented Generation) from MinIO documents and error context.
         * This provides graceful error handling and still attempts to answer the user.
         * 
         * WHY WE USE IT:
         * - Provides user-friendly error messages instead of raw SQL errors
         * - Attempts to answer query using available document context
         * - Maintains conversation flow even when SQL generation fails
         * - Helps users understand what went wrong and how to fix it
         * 
         * EXAMPLE INPUT:
         *   Query: "Show me species data for Berau district (Fallback to RAG)"
         *   Data: [] (empty, SQL failed)
         *   Context: [
         *     "SQL execution failed: relation \"species_data\" does not exist",
         *     "Generated SQL Query: SELECT * FROM \"species_data\" WHERE ...",
         *     "MinIO Doc 1: Berau district is located in East Kalimantan...",
         *     "MinIO Doc 2: Species data collection methodology..."
         *   ]
         * 
         * EXAMPLE OUTPUT:
         *   {
         *     text: "Maaf, saya tidak dapat mengeksekusi query SQL karena tabel 'species_data' tidak ditemukan. Namun berdasarkan dokumen yang tersedia, Berau adalah sebuah kabupaten di Kalimantan Timur yang memiliki keanekaragaman hayati yang tinggi...",
         *     usage: { prompt: 450, completion: 120, total: 570, source: 'measured' }
         *   }
         */
        const summarizationAgent = new SummarizationAgent()
        const ragRes = await summarizationAgent.execute(`${query} (Fallback to RAG)`, [],
          [
            `SQL execution failed: ${errorMessage}`,
            `Generated SQL Query: ${sqlQuery}`,
            ...relevantMinioDocs.map((r) => r.document_text)
          ]
        )
        // Compute usage and cost, persist, then respond
        const embUsage = { prompt: Math.ceil(query.length / 4), completion: 0, total: Math.ceil(query.length / 4), source: 'estimated' as const }
        const combinedUsage = {
          embedding: embUsage,
          sql: sqlUsage ?? null,
          summarize: ragRes.usage,
          total: embUsage.total + (sqlUsage?.total ?? 0) + (ragRes.usage?.total ?? 0)
        }
        const embeddingModel = userConfig.embeddingAgentModel ?? process.env.EMBEDDING_AGENT_MODEL
        const sqlModel = userConfig.sqlGeneratorAgentModel ?? process.env.SQL_GENERATOR_AGENT_MODEL
        const sumModel = userConfig.summarizationModel ?? process.env.SUMMARIZATION_MODEL
        const embUsd = costUsdFor(embeddingModel, embUsage.prompt, 0)
        const sqlUsd = costUsdFor(sqlModel, (sqlUsage?.prompt ?? 0), (sqlUsage?.completion ?? 0))
        const sumUsd = costUsdFor(sumModel, (ragRes.usage?.prompt ?? 0), (ragRes.usage?.completion ?? 0))
        const combinedCost = { embeddingUsd: embUsd, sqlUsd, summarizeUsd: sumUsd, totalUsd: embUsd + sqlUsd + sumUsd }

        // Save to DB only if storeInDB is true and user exists
        if (storeInDB && dbUser) {
          await saveChatHistoryToDB({
            role: 'assistant',
            projectId,
            userId: verifiedUserId,
            content: ragRes.text,
            sqlQuery,
            ragNodeDocuments: relevantNodeDocs,
            ragMinioDocuments: relevantMinioDocs,
            improvedPrompt: JSON.stringify({ tokenUsage: combinedUsage, tokenCost: combinedCost }),
            tokenUsage: combinedUsage,
            tokenCost: combinedCost,
            data: [],
            timestamp: new Date()
          })
        }

        // Include all agent results when storeInDB is false
        const response: any = { 
          status: 'success', 
          answer: ragRes.text, 
          tokenUsage: combinedUsage, 
          tokenCost: combinedCost 
        }
        if (!storeInDB) {
          response.agentResults = {
            embedding: {
              model: embeddingModelForEmbedding,
              usage: embUsage
            },
            episodicMemory: episodicSnippets,
            semanticMemory: semanticSnippets,
            nodeDocuments: relevantNodeDocs,
            minioDocuments: relevantMinioDocs,
            rerank: rerankResults,
            sqlGeneration: {
              query: sqlQuery,
              usage: sqlUsage
            },
            sqlExecution: {
              data: [],
              error: errorMessage
            },
            summarization: {
              text: ragRes.text,
              usage: ragRes.usage
            }
          }
        }
        return NextResponse.json(response)
      }
    }

    /**
     * ====================================================================
     * SUMMARIZATION AGENT (Primary Mode - Generate Final Answer)
     * ====================================================================
     * 
     * PURPOSE:
     * Generates a natural language answer by combining SQL query results, context
     * documents, and memory snippets. This agent transforms raw data into a
     * conversational, user-friendly response in the user's language.
     * 
     * WHY WE USE IT:
     * - Converts raw SQL results into readable, conversational answers
     * - Incorporates context from MinIO documents for richer explanations
     * - Uses memory snippets to provide additional relevant information
     * - Automatically detects and responds in the user's language (Indonesian/English)
     * - Provides concise, friendly responses tailored to Nature-Based Solutions domain
     * 
     * HOW IT WORKS:
     * Uses SeaLLM (or configured LLM) with a system prompt that:
     * 1. Establishes the agent as an expert on Nature-Based Solutions
     * 2. Instructs to use provided data and context
     * 3. Enforces language consistency (matches user's query language)
     * 4. Keeps responses concise and conversational
     * 
     * The agent receives:
     * - User's original query
     * - SQL execution results (data rows)
     * - Context documents (MinIO docs + semantic + episodic memory)
     * 
     * EXAMPLE INPUT:
     *   Query: "Show me species data for Berau district"
     *   Data: [
     *     { district_name: "Berau", mammal_count: 150, reptile_count: 45, bird_count: 320 },
     *     { district_name: "Berau", mammal_count: 152, reptile_count: 46, bird_count: 325 }
     *   ]
     *   Context: [
     *     "MinIO Doc: Berau district is known for its rich biodiversity...",
     *     "Semantic: Episode: Show species in Berau — Berau has high mammal diversity...",
     *     "Episodic: user: What about reptiles?\nassistant: Berau has 45 reptile species..."
     *   ]
     * 
     * EXAMPLE OUTPUT:
     *   {
     *     text: "Kabupaten Berau memiliki keanekaragaman hayati yang cukup tinggi. Berdasarkan data terbaru, terdapat sekitar 150-152 spesies mamalia, 45-46 spesies reptil, dan 320-325 spesies burung. Total keseluruhan mencapai lebih dari 500 spesies, menjadikan Berau sebagai salah satu kawasan dengan biodiversitas tertinggi di Kalimantan Timur.",
     *     usage: {
     *       prompt: 850,
     *       completion: 95,
     *       total: 945,
     *       source: 'measured'
     *     }
     *   }
     * 
     * USE CASE:
     * This is the final step in the pipeline. The generated answer is:
     * 1. Saved to chat history
     * 2. Stored in semantic memory for future reference
     * 3. Returned to the user
     * 4. Used for procedural memory logging
     */
    const summarizationAgent = new SummarizationAgent()
    const ctxDocs = [
      // Use memory pack and snippets plus MinIO docs as extra context
      ...([/* memoryPack repeated for summarizer scope */].concat([])),
      ...relevantMinioDocs.map((r) => r.document_text),
      ...semanticSnippets,
      ...episodicSnippets
    ]
    // bump cache namespace to avoid legacy string payloads
    const sumModelForCache = (userConfig.summarizationModel ?? process.env.SUMMARIZATION_MODEL) || 'SeaLLM'
    const sumKey = `sum:v2:${sumModelForCache}:${sha256(query + '|' + JSON.stringify(data).slice(0, 4000) + '|' + sha256(ctxDocs.join('\n').slice(0, 4000)))}`
    const summarizationEndpoint = (userConfig.summarizationModelEndpoint ?? process.env.SUMMARIZATION_MODEL_ENDPOINT) || ''
    const summarizationModelForGen = (userConfig.summarizationModel ?? process.env.SUMMARIZATION_MODEL) || ''
    const sumRes2 = await cacheGetOrSet(sumKey, 60 * 20, async () => (
      await summarizationAgent.execute(query, data, ctxDocs, summarizationEndpoint, summarizationModelForGen)
    ))

    const sumAny: any = sumRes2 as any
    const sumObj: SumObj = (typeof sumAny === 'string')
      ? { text: sumAny as string, usage: { prompt: 0, completion: Math.ceil((sumAny as string).length / 4), total: Math.ceil((sumAny as string).length / 4), source: 'estimated' } }
      : (sumAny as SumObj)
    const answer = sumObj.text

    /**
     * ====================================================================
     * MEMORY AGENT - Semantic Memory Write-Back
     * ====================================================================
     * 
     * PURPOSE:
     * Stores the query-answer pair as semantic memory for future retrieval.
     * This enables the system to learn from each interaction and reuse knowledge
     * in subsequent queries, even if phrased differently.
     * 
     * WHY WE USE IT:
     * - Enables knowledge accumulation over time
     * - Allows future queries to leverage past successful answers
     * - Improves response quality by referencing learned facts
     * - Reduces redundant processing for similar queries
     * - Creates a knowledge base specific to each project
     * 
     * HOW IT WORKS:
     * Creates a compact fact string combining the query and answer, generates
     * an embedding for it, and stores it in the mem_semantic table with relevant
     * tags (province, district, species, etc.) for easier filtering.
     * 
     * EXAMPLE INPUT:
     *   Query: "Show me species data for Berau district"
     *   Answer: "Kabupaten Berau memiliki keanekaragaman hayati yang cukup tinggi..."
     *   Tags: ['episode', 'auto', 'district', 'species']
     * 
     * EXAMPLE OUTPUT:
     *   Stored in database:
     *   {
     *     content: "Episode: Show me species data for Berau district — Kabupaten Berau memiliki keanekaragaman hayati yang cukup tinggi. Berdasarkan data terbaru, terdapat sekitar 150-152 spesies mamalia...",
     *     embedding: [0.0234, -0.0123, ..., 0.0456], // Generated embedding
     *     tags: ['episode', 'auto', 'district', 'species']
     *   }
     * 
     * USE CASE:
     * Future queries like "What about Berau biodiversity?" or "Tell me about
     * species in Berau" will retrieve this stored fact and use it to provide
     * better context for SQL generation and answer summarization.
     */
    if (MEM_SEMANTIC_WRITE_ENABLED && storeInDB && dbUser) {
      // Basic entity tags from query
      const tags: string[] = ['episode', 'auto']
      if (/province|provinsi/i.test(query)) tags.push('province')
      if (/district|kabupaten|kota/i.test(query)) tags.push('district')
      if (/species|spesies/i.test(query)) tags.push('species')
      const toStore = `Episode: ${query.slice(0, 160)} — ${answer.slice(0, 1200)}`
      await memoryAgent.saveSemanticMemory({ userId: verifiedUserId, projectId, content: toStore, tags })
    }

    // Compute usage+cost for persistence
    const embUsage = { prompt: Math.ceil(query.length / 4), completion: 0, total: Math.ceil(query.length / 4), source: 'estimated' as const }
    const combinedUsagePersist = {
      embedding: embUsage,
      sql: null,
      summarize: sumObj.usage,
      total: embUsage.total + sumObj.usage.total
    }
    const embeddingModelPersist = userConfig.embeddingAgentModel ?? process.env.EMBEDDING_AGENT_MODEL
    const sumModelPersist = userConfig.summarizationModel ?? process.env.SUMMARIZATION_MODEL
    const embUsdPersist = costUsdFor(embeddingModelPersist, embUsage.prompt, 0)
    const sumUsdPersist = costUsdFor(sumModelPersist, (sumObj.usage?.prompt ?? 0), (sumObj.usage?.completion ?? 0))
    const combinedCostPersist = { embeddingUsd: embUsdPersist, sqlUsd: 0, summarizeUsd: sumUsdPersist, totalUsd: embUsdPersist + sumUsdPersist }

    // Save assistant response to DB only if storeInDB is true and user exists
    if (storeInDB && dbUser) {
      await saveChatHistoryToDB({
        role: 'assistant',
        projectId,
        userId: verifiedUserId,
        content: answer,
        sqlQuery,
        ragNodeDocuments: relevantNodeDocs,
        ragMinioDocuments: relevantMinioDocs,
        improvedPrompt: JSON.stringify({ tokenUsage: combinedUsagePersist, tokenCost: combinedCostPersist }),
        tokenUsage: combinedUsagePersist,
        tokenCost: combinedCostPersist,
        data,
        timestamp: new Date()
      })
    }

    /**
     * ====================================================================
     * MEMORY AGENT - Procedural Memory Logging
     * ====================================================================
     * 
     * PURPOSE:
     * Logs the execution flow and decisions made during query processing.
     * This creates an audit trail and enables analysis of pipeline performance,
     * helping identify patterns, optimize configurations, and debug issues.
     * 
     * WHY WE USE IT:
     * - Provides audit trail for debugging and optimization
     * - Enables analysis of which configurations work best
     * - Helps identify patterns in query processing
     * - Supports A/B testing of different pipeline configurations
     * - Creates searchable logs for troubleshooting
     * 
     * HOW IT WORKS:
     * Stores a JSON payload with pipeline execution details as semantic memory
     * with a 'procedure' tag, making it searchable and auditable. The details
     * include configuration parameters, document counts, and execution outcomes.
     * 
     * EXAMPLE INPUT:
     *   {
     *     userId: "user123",
     *     projectId: "proj456",
     *     name: "search_pipeline_v1",
     *     details: {
     *       use_hybrid: true,
     *       hybrid_alpha: 0.7,
     *       min_cosine: 0.2,
     *       top_k: 5,
     *       rerankEnabled: true,
     *       semanticSnippets: 3,
     *       episodicSnippets: 2,
     *       nodeDocs: 8,
     *       minioDocs: 5,
     *       hadSql: true,
     *       dataRows: 2
     *     }
     *   }
     * 
     * EXAMPLE OUTPUT:
     *   Stored in mem_semantic table:
     *   {
     *     content: "[PROCEDURE:search_pipeline_v1] {\"use_hybrid\":true,\"hybrid_alpha\":0.7,...}",
     *     tags: ['procedure']
     *   }
     * 
     * USE CASE:
     * Can be queried later to analyze:
     * - Which queries used SQL vs RAG-only
     * - Average document counts retrieved
     * - Success rates of different configurations
     * - Performance patterns over time
     */
    if (MEM_PROCEDURAL_ENABLED && storeInDB && dbUser) {
      await memoryAgent.logProcedure({
        userId: verifiedUserId,
        projectId,
        name: 'search_pipeline_v1',
        details: {
          use_hybrid,
          hybrid_alpha,
          min_cosine,
          top_k,
          rerankEnabled: userConfig.rerankEnabled ?? (process.env.RERANK_ENABLED ?? 'true').toLowerCase() !== 'false',
          semanticSnippets: semanticSnippets.length,
          chosenSemanticIds,
          episodicSnippets: episodicSnippets.length,
          nodeDocs: (typeof relevantNodeDocs !== 'undefined') ? relevantNodeDocs.length : 0,
          minioDocs: (typeof relevantMinioDocs !== 'undefined') ? relevantMinioDocs.length : 0,
          hadSql: Boolean(sqlQuery),
          dataRows: Array.isArray(data) ? data.length : 0
        }
      })
    }

    // Include tokenUsage in API response
    const combinedUsage = {
      embedding: embUsage,
      sql: sqlUsage,
      summarize: sumObj.usage,
      total: embUsage.total + (sqlUsage?.total ?? 0) + sumObj.usage.total
    }
    // Cost calculation (USD) using OPENAI_PRICES map and user config models
    const embeddingModel = userConfig.embeddingAgentModel ?? process.env.EMBEDDING_AGENT_MODEL
    const sqlModel = userConfig.sqlGeneratorAgentModel ?? process.env.SQL_GENERATOR_AGENT_MODEL
    const sumModel = userConfig.summarizationModel ?? process.env.SUMMARIZATION_MODEL
    const embUsd = costUsdFor(embeddingModel, embUsage.prompt, 0)
    const sqlUsd = costUsdFor(sqlModel, (sqlUsage?.prompt ?? 0), (sqlUsage?.completion ?? 0))
    const sumUsd = costUsdFor(sumModel, (sumObj.usage?.prompt ?? 0), (sumObj.usage?.completion ?? 0))
    const combinedCost = { embeddingUsd: embUsd, sqlUsd, summarizeUsd: sumUsd, totalUsd: embUsd + sqlUsd + sumUsd }
    
    // Include all agent results when storeInDB is false
    const response: any = { 
      status: 'success', 
      answer, 
      tokenUsage: combinedUsage, 
      tokenCost: combinedCost 
    }
    if (!storeInDB) {
      response.agentResults = {
        embedding: {
          model: embeddingModelForEmbedding,
          usage: embUsage
        },
        episodicMemory: episodicSnippets,
        semanticMemory: semanticSnippets,
        nodeDocuments: relevantNodeDocs,
        minioDocuments: relevantMinioDocs,
        rerank: rerankResults,
        sqlGeneration: {
          query: sqlQuery,
          usage: sqlUsage
        },
        sqlExecution: {
          data: data
        },
        summarization: {
          text: answer,
          usage: sumObj.usage
        }
      }
    }
    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in search API:', error)

    return createErrorResponse(
      'Failed to process search query',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}
