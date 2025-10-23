import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  sqlQuery?: string
  ragDocuments?: any[]
  data?: any
}

interface SearchRequest {
  query: string
  min_cosine: number
  top_k: number
  projectId: string
  chatHistory?: ChatMessage[]
}

// Function to get chat history from database
async function getChatHistoryFromDB(userId: string, projectId: string): Promise<ChatMessage[]> {
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

// Function to save chat history to database
async function saveChatHistoryToDB(userId: string, projectId: string, messages: ChatMessage[]): Promise<void> {
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

function createPrismaClientWithSchema(schemaName: string): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined')
  }

  // if ?schema=... already present, replace; otherwise append correctly
  const hasQuery = databaseUrl.includes('?')
  const hasSchema = /(?:\?|&)schema=\w+/.test(databaseUrl)

  const customDatabaseUrl = hasSchema
    ? databaseUrl.replace(/schema=\w+/, `schema=${schemaName}`)
    : `${databaseUrl}${hasQuery ? '&' : '?'}schema=${schemaName}`

  return new PrismaClient({
    datasources: {
      db: { url: customDatabaseUrl }
    }
  })
}

// Function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

// Function to generate embedding for the search query
async function generateQueryEmbedding(query: string): Promise<number[]> {
  console.log('query ', query)
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: query,
    })

    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating query embedding:', error)
    throw new Error('Failed to generate query embedding')
  }
}

// Function to search for relevant RAG documents
async function searchRagDocuments(queryEmbedding: number[], minCosine: number, topK: number) {
  // Get all RAG documents with embeddings
  const ragDocs = await (prisma.ragDocs.findMany as any)({
    where: {
      embedding: {
        not: null
      }
    },
    include: {
      node: {
        include: {
          project: true
        }
      }
    }
  })

  // Calculate similarities and filter by minimum cosine similarity
  const similarities: Array<{ doc: any; similarity: number }> = []

  for (const doc of ragDocs) {
    if (doc.embedding) {
      try {
        const docEmbedding = JSON.parse(doc.embedding) as number[]
        const similarity = cosineSimilarity(queryEmbedding, docEmbedding)

        if (similarity >= minCosine) {
          similarities.push({ doc, similarity })
        }
      } catch (error) {
        console.error('Error parsing embedding for doc:', doc.id, error)
      }
    }
  }

  // Sort by similarity and return top K results
  similarities.sort((a, b) => b.similarity - a.similarity)
  return similarities.slice(0, topK)
}

// Function to sanitize schema name for SQL/Prisma
// function sanitizeSchemaName(projectId: string): string {
//   // Remove or replace invalid characters for SQL identifiers
//   let sanitized = projectId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()

//   // If it starts with a number, prefix with underscore
//   if (/^[0-9]/.test(sanitized)) {
//     sanitized = '_' + sanitized
//   }

//   // Ensure it's not empty
//   if (!sanitized) {
//     sanitized = 'project_' + projectId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
//   }

//   return sanitized
// }

// Function to generate SQL query using OpenAI
async function generateSQLQuery(query: string, relevantDocs: any[]): Promise<string> {
  try {
    // Prepare context from relevant documents
    const context = relevantDocs.map(item => ({
      table: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
      text: item.doc.text,
      similarity: item.similarity
    }))

    const prompt = `
You are a SQL expert. Based on the following database schema information and the user's query, generate an appropriate SQL query.

User Query: "${query}"

Relevant Database Schema Information:
${context.map(ctx => `- ${ctx.text} (Similarity: ${ctx.similarity.toFixed(3)})`).join('\n')}

Instructions:
1. Generate a SQL query that answers the user's question
2. Use the table and column names exactly as provided in the schema
3. Include appropriate JOINs if multiple tables are involved
4. Use proper PostgreSQL syntax
5. Use table names WITHOUT schema prefixes (tables are in the public schema)
6. Return ONLY the raw SQL query - NO markdown formatting, NO code blocks, NO explanations
7. Use double quotes around table and column names for safety
8. Do NOT wrap the query in code blocks or any other formatting
9. IMPORTANT: Do NOT use schema prefixes like "default" or any schema name - just use table names directly
10. ALWAYS make sure to include LIMIT, by default LIMIT 10 at the end of the query if the user's query is not a count query
11. Always use ILIKE instead of WHERE for text matching.
12. When using ILIKE, wrap the search term with %% (e.g., ILIKE '%pattern%'), ensuring the query matches parts of the text case-insensitively.

SQL Query:`

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a SQL expert. Generate accurate SQL queries based on database schema information."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    })

    return completion.choices[0]?.message?.content?.trim() || ''
  } catch (error) {
    console.error('Error generating SQL query:', error)
    throw new Error('Failed to generate SQL query')
  }
}

// Function to clean SQL query from markdown formatting
function cleanSQLQuery(sqlQuery: string): string {
  // Remove markdown code blocks (both ```sql and ```)
  let cleaned = sqlQuery.replace(/```sql\s*/gi, '').replace(/```\s*$/g, '')

  // Remove any remaining markdown formatting
  cleaned = cleaned.replace(/```/g, '')

  // Remove any leading/trailing whitespace and newlines
  cleaned = cleaned.trim()

  // Remove schema prefixes - convert "schema"."table" to "table"
  cleaned = cleaned.replace(/"([^"]+)"\."([^"]+)"/g, '"$2"')

  return cleaned
}

// Function to execute SQL query using project schema (via a dedicated Prisma client)
async function executeSQLQuery(
  sqlQuery: string,
  projectId: string,
  userQuery: string,
  chatHistory: ChatMessage[] = []
): Promise<{ data: any[], answer: string }> {
  // Build a per-project/schema Prisma client using sanitized schema
  // const schema = sanitizeSchemaName(projectId)
  const prismaForSchema = createPrismaClientWithSchema(projectId)

  try {
    // Clean the SQL query first (this removes schema prefixes)
    const cleanedQuery = cleanSQLQuery(sqlQuery)

    // Execute against the project's schema
    const result = await prismaForSchema.$queryRawUnsafe(cleanedQuery)

    // Generate a natural-language answer based on the user's query and the results (no SQL mention)
    const answer = await generateAnswer(userQuery, result as any[], chatHistory)

    return {
      data: result as any[],
      answer
    }
  } catch (error) {
    console.error('Error executing SQL query:', error)
    throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    // In serverless environments it's fine to disconnect after each request.
    // If you switch to a long-lived runtime, consider reusing the client instead.
    await prismaForSchema.$disconnect().catch(() => { })
  }
}

// Function to generate natural language answer (no SQL mention)
async function generateAnswer(userQuery: string, data: any[], chatHistory: ChatMessage[] = []): Promise<string> {
  try {
    // Build conversation context from chat history
    const conversationContext = chatHistory.length > 0
      ? `\n\nPrevious conversation:\n${chatHistory.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
      : ''

    const prompt = `
You're an expert researcher on Nature-Based Solutions. Keep your response SHORT and conversational.

Current question:
${userQuery}
${conversationContext}

Data:
${JSON.stringify(data, null, 2)}

Guidelines:
- Keep it SHORT (2-5 sentences max)
- Be conversational and friendly
- If data is empty, just say "No data found for this query"
- Don't repeat previous conversation details unless directly relevant

Your short response:
`

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: "system",
        content: "You're having a friendly, SHORT conversation about Nature-Based Solutions data. Keep responses brief and conversational."
      }
    ]

    // Add recent chat history to maintain context
    if (chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-8) // Last 8 messages for context
      messages.push(...recentHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })))
    }

    messages.push({
      role: "user",
      content: prompt
    })

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500 // Much shorter responses
    })

    return (
      completion.choices[0]?.message?.content?.trim() ||
      "No data found for this query."
    )
  } catch (error) {
    console.error("Error generating answer:", error)
    return "Sorry, couldn't analyze the data right now."
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get current user
    const user = await getCurrentUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body: SearchRequest = await request.json()
    const { query, min_cosine = 0.7, top_k = 5, projectId } = body

    // Get chat history from database if not provided
    const chatHistory = body.chatHistory || await getChatHistoryFromDB(user.id, projectId)

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (min_cosine < 0 || min_cosine > 1) {
      return NextResponse.json({ error: 'min_cosine must be between 0 and 1' }, { status: 400 })
    }

    if (top_k < 1 || top_k > 20) {
      return NextResponse.json({ error: 'top_k must be between 1 and 20' }, { status: 400 })
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateQueryEmbedding(query)

    // Search for relevant RAG documents
    const relevantDocs = await searchRagDocuments(queryEmbedding, min_cosine, top_k)

    if (relevantDocs.length === 0) {
      const updatedChatHistory: ChatMessage[] = [
        ...chatHistory,
        { role: 'user', content: query, timestamp: new Date().toISOString() },
        {
          role: 'assistant',
          content: 'No relevant schema information found to generate a query.',
          timestamp: new Date().toISOString(),
          sqlQuery: undefined,
          ragDocuments: []
        }
      ]

      // Save chat history to database
      await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

      return NextResponse.json({
        success: true,
        query,
        message: 'No relevant schema information found for the given query',
        sqlQuery: null,
        answer: 'No relevant schema information found to generate a query.',
        data: [],
        chatHistory: updatedChatHistory,
        relevantDocuments: []
      })
    }

    // Generate SQL query using the relevant documents
    const sqlQuery = await generateSQLQuery(query, relevantDocs)

    if (!sqlQuery) {
      const updatedChatHistory: ChatMessage[] = [
        ...chatHistory,
        { role: 'user', content: query, timestamp: new Date().toISOString() },
        {
          role: 'assistant',
          content: 'Unable to generate a valid SQL query for the given question.',
          timestamp: new Date().toISOString(),
          sqlQuery: undefined,
          ragDocuments: relevantDocs.map(item => ({
            id: item.doc.id,
            tableName: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
            text: item.doc.text,
            similarity: item.similarity,
            documentType: item.doc.text.includes('Column:') ? 'column' : 'table'
          }))
        }
      ]

      // Save chat history to database
      await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

      return NextResponse.json({
        success: true,
        query,
        message: 'Failed to generate SQL query',
        sqlQuery: null,
        answer: 'Unable to generate a valid SQL query for the given question.',
        data: [],
        chatHistory: updatedChatHistory,
        relevantDocuments: relevantDocs.map(item => ({
          id: item.doc.id,
          tableName: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
          text: item.doc.text,
          similarity: item.similarity,
          documentType: item.doc.text.includes('Column:') ? 'column' : 'table'
        }))
      })
    }

    // Execute the SQL query
    let executionResult
    try {
      executionResult = await executeSQLQuery(sqlQuery, projectId, query, chatHistory) // pass user query and chat history
    } catch (executionError) {
      const updatedChatHistory: ChatMessage[] = [
        ...chatHistory,
        { role: 'user', content: query, timestamp: new Date().toISOString() },
        {
          role: 'assistant',
          content: `Query generated but execution failed: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
          sqlQuery: sqlQuery,
          ragDocuments: relevantDocs.map(item => ({
            id: item.doc.id,
            tableName: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
            text: item.doc.text,
            similarity: item.similarity,
            documentType: item.doc.text.includes('Column:') ? 'column' : 'table'
          }))
        }
      ]

      // Save chat history to database
      await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

      return NextResponse.json({
        success: true,
        query,
        sqlQuery,
        answer: `Query generated but execution failed: ${executionError instanceof Error ? executionError.message : 'Unknown error'}`,
        data: [],
        chatHistory: updatedChatHistory,
        relevantDocuments: relevantDocs.map(item => ({
          id: item.doc.id,
          tableName: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
          text: item.doc.text,
          similarity: item.similarity,
          documentType: item.doc.text.includes('Column:') ? 'column' : 'table'
        })),
        searchStats: {
          totalDocumentsFound: relevantDocs.length,
          minCosineThreshold: min_cosine,
          topK: top_k
        }
      })
    }

    // Create updated chat history with the new exchange
    const updatedChatHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: query, timestamp: new Date().toISOString() },
      {
        role: 'assistant',
        content: executionResult.answer,
        timestamp: new Date().toISOString(),
        sqlQuery: sqlQuery,
        ragDocuments: relevantDocs.map(item => ({
          id: item.doc.id,
          tableName: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
          text: item.doc.text,
          similarity: item.similarity,
          documentType: item.doc.text.includes('Column:') ? 'column' : 'table'
        })),
        data: executionResult.data
      }
    ]

    // Save chat history to database
    await saveChatHistoryToDB(user.id, projectId, updatedChatHistory)

    return NextResponse.json({
      success: true,
      query,
      sqlQuery,
      answer: executionResult.answer,
      data: executionResult.data,
      chatHistory: updatedChatHistory,
      relevantDocuments: relevantDocs.map(item => ({
        id: item.doc.id,
        tableName: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
        text: item.doc.text,
        similarity: item.similarity,
        documentType: item.doc.text.includes('Column:') ? 'column' : 'table'
      })),
      searchStats: {
        totalDocumentsFound: relevantDocs.length,
        minCosineThreshold: min_cosine,
        topK: top_k
      }
    })

  } catch (error) {
    console.error('Error in search API:', error)
    return NextResponse.json({
      error: 'Failed to process search query',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
