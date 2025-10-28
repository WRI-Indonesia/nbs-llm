import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

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
  context: any[]
): Promise<{ data: any[], answer: string }> {
  const prismaForSchema = createPrismaClientWithSchema(projectId)

  try {
    // Clean the SQL query first (this removes schema prefixes)
    const cleanedQuery = cleanSQLQuery(sqlQuery)

    // Execute against the project's schema
    const result = await prismaForSchema.$queryRawUnsafe(cleanedQuery)

    // Generate a natural-language answer based on the user's query and the results
    const answer = await generateAnswer(userQuery, result as any[], context)

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
// async function generateAnswer(userQuery: string, data: any[], context: any[]): Promise<string> {
//   try {
//     const prompt = `
// You're an expert researcher on Nature-Based Solutions. Keep your response SHORT and conversational.

// Current question:
// ${userQuery}

// Data:
// ${JSON.stringify(data, null, 2)}

// Context:
// ${JSON.stringify(context, null, 2)}

// Guidelines:
// - Keep it SHORT (2-5 sentences max)
// - Be conversational and friendly
// - If data is empty, just say "No data found for this query"
// - Don't repeat previous conversation details unless directly relevant

// Your short response:
// `

//     const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
//       {
//         role: "system",
//         content: "You're having a friendly, SHORT conversation about Nature-Based Solutions data. Keep responses brief and conversational."
//       }
//     ]

//     messages.push({
//       role: "user",
//       content: prompt
//     })

//     const completion = await openai.chat.completions.create({
//       model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
//       messages,
//       temperature: 0.7,
//       max_tokens: 500 // Much shorter responses
//     })

//     return (
//       completion.choices[0]?.message?.content?.trim() ||
//       "No data found for this query."
//     )
//   } catch (error) {
//     console.error("Error generating answer:", error)
//     return "Sorry, couldn't analyze the data right now."
//   }
// }

async function generateAnswer(userQuery: string, data: any[], context: any[]): Promise<string> {
  // Define the new API endpoint and model
  const SEA_LLM_ENDPOINT = "https://seallm.wri-indonesia.or.id/v1/chat/completions";
  const SEA_LLM_MODEL = "SeaLLMs/SeaLLM-7B-v2.5";

  try {
    // 1. Construct a detailed prompt that strongly integrates data and context
    const contextString = context.length > 0
      ? `\n\n--- Relevant Context ---\n${JSON.stringify(context, null, 2)}`
      : "";

    const dataString = data.length > 0
      ? `\n\n--- Current Query Data ---\n${JSON.stringify(data, null, 2)}`
      : "";

    if (data.length === 0) {
      return "No data found for this query";
    }

    const systemPrompt = "You are an expert researcher on Nature-Based Solutions. Keep your response SHORT, conversational, and friendly. You MUST use the provided 'Context' and 'Current Query Data' to formulate your answer.";

    const userMessage = `
Current question: ${userQuery}

${dataString}
${contextString}

Guidelines:
- Keep it SHORT (2-5 sentences max)
- Be conversational and friendly
- Base your entire answer on the provided data and context.
- Your short response:
`;

    // 2. Prepare the payload for the SeaLLM API
    const payload = {
      model: SEA_LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.4,
      max_tokens: 500
    };

    // 3. Make the API call using fetch
    const response = await fetch(SEA_LLM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Note: Check if the SeaLLM endpoint requires an Authorization header/API key.
        // If it does, you would need to add it here, e.g.:
        // 'Authorization': `Bearer ${process.env.SEA_LLM_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    // 4. Extract and return the answer
    return (
      result.choices?.[0]?.message?.content?.trim() ||
      "Sorry, I got data back, but it was empty."
    );

  } catch (error) {
    console.error("Error generating answer with SeaLLM:", error);
    return "Sorry, couldn't analyze the data right now.";
  }
}