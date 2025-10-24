import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import { ChatMessage } from './response-utils'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Creates a Prisma client with a specific schema
 */
export function createPrismaClientWithSchema(schemaName: string): PrismaClient {
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

/**
 * Generates embedding for the search query using OpenAI
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
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

/**
 * Generates SQL query using OpenAI based on relevant documents
 */
export async function generateSQLQuery(query: string, relevantDocs: any[]): Promise<string> {
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
      temperature: 0,
      max_tokens: 500
    })

    return completion.choices[0]?.message?.content?.trim() || ''
  } catch (error) {
    console.error('Error generating SQL query:', error)
    throw new Error('Failed to generate SQL query')
  }
}

/**
 * Cleans SQL query from markdown formatting
 */
export function cleanSQLQuery(sqlQuery: string): string {
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

/**
 * Executes SQL query using project schema
 */
export async function executeSQLQuery(
  sqlQuery: string,
  projectId: string,
  userQuery: string,
  chatHistory: ChatMessage[] = []
): Promise<{ data: any[], answer: string }> {
  const prismaForSchema = createPrismaClientWithSchema(projectId)

  try {
    // Clean the SQL query first (this removes schema prefixes)
    const cleanedQuery = cleanSQLQuery(sqlQuery)

    // Execute against the project's schema
    const result = await prismaForSchema.$queryRawUnsafe(cleanedQuery)

    // Generate a natural-language answer based on the user's query and the results
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
    await prismaForSchema.$disconnect().catch(() => { })
  }
}

/**
 * Generates natural language answer based on query results
 */
async function generateAnswer(userQuery: string, data: any[], chatHistory: ChatMessage[] = []): Promise<string> {
  try {
    const prompt = `
You're an expert researcher on Nature-Based Solutions. Keep your response SHORT and conversational.

Current question:
${userQuery}

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
