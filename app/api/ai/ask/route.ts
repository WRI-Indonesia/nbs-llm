import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EMBED_MODEL = process.env.EMBED_MODEL_NAME || 'text-embedding-3-large'
const CHAT_MODEL_DEFAULT = process.env.CHAT_MODEL || 'gpt-4o-mini'

const SQL_SYSTEM_PROMPT = `You are a precise SQL generator for PostgreSQL.

Rules:
- Output a single SQL code block without commentary.
- Use table and column names exactly as provided by the context.
- When joining, follow the Foreign-Key Join Hints exactly (e.g., nature.district_name = adm.district).
- Prefer ANSI SQL compatible with PostgreSQL.
- If dates are strings, cast only when necessary.
- If a query is ambiguous, make the most reasonable minimal assumption.
- Do not invent tables or columns.`

interface AskBody {
  question: string
  topK?: number
  minScore?: number
  chatModel?: string
  sessionId?: string
  schemaId?: string
}

// Simple text similarity function (fallback when pgvector is not available)
function calculateTextSimilarity(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/)
  const textWords = text.toLowerCase().split(/\s+/)
  
  let matches = 0
  for (const word of queryWords) {
    if (textWords.includes(word)) {
      matches++
    }
  }
  
  return matches / queryWords.length
}

// Get embeddings from OpenAI
async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: text,
    })
    return response.data[0].embedding
  } catch (error) {
    console.error('Error getting embedding:', error)
    throw new Error('Failed to get embedding')
  }
}

// Calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Fetch RAG docs from database
async function fetchRagDocs() {
  try {
    const docs = await prisma.ragDoc.findMany({
      orderBy: { id: 'asc' }
    })
    
    return docs.map(doc => ({
      id: doc.id,
      text: doc.text,
      payload: doc.payload as any,
      embedding: doc.embedding
    }))
  } catch (error) {
    console.error('Error fetching RAG docs:', error)
    return []
  }
}

// Get schema by ID
async function getSchemaById(schemaId: string) {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/schemas/${schemaId}`)
    if (response.ok) {
      const data = await response.json()
      return data.schema
    }
    return null
  } catch (error) {
    console.error('Error fetching schema by ID:', error)
    return null
  }
}

// Get current schema data for simulation (fallback)
async function getCurrentSchema(sessionId?: string) {
  try {
    if (!sessionId) return null
    
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/schemas?sessionId=${sessionId}`)
    if (response.ok) {
      const data = await response.json()
      return data.schemas?.find((s: any) => s.name === 'default')
    }
    return null
  } catch (error) {
    console.error('Error fetching current schema:', error)
    return null
  }
}

// Execute SQL query directly against the database using Prisma
async function executeSQLQuery(sql: string): Promise<{ result: any[], columns: string[], error?: string }> {
  try {
    console.log('Executing SQL:', sql)
    
    // Use Prisma's raw query functionality
    const result = await prisma.$queryRawUnsafe(sql)
    
    // Convert result to array format
    const resultArray = Array.isArray(result) ? result : [result]
    
    // Extract column names from the first row if available
    let columns: string[] = []
    if (resultArray.length > 0 && typeof resultArray[0] === 'object') {
      columns = Object.keys(resultArray[0])
    }
    
    return {
      result: resultArray,
      columns
    }
  } catch (error: any) {
    console.error('SQL execution error:', error)
    return {
      result: [],
      columns: [],
      error: error.message
    }
  }
}

// Get list of actual tables in the database
async function getActualTables(): Promise<string[]> {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `) as any[]
    
    return result.map(row => row.table_name)
  } catch (error) {
    console.error('Error getting actual tables:', error)
    return []
  }
}

// Convert OpenAI generated SQL to query schema data using OpenAI with retry loop
async function convertToSchemaDataQuery(sql: string, schemaData: any, schemaId: string): Promise<string> {
  try {
    if (!schemaData?.graphJson?.nodes) {
      return sql // Return original SQL if no schema data
    }

    // Extract table names from SQL
    const tableMatches = sql.match(/\b(?:FROM|JOIN)\s+(\w+)/gi) || []
    const tables = tableMatches.map(match => match.replace(/(?:FROM|JOIN)\s+/i, '').toLowerCase())

    console.log('Extracted tables from SQL:', tables)
    console.log('Schema nodes:', schemaData.graphJson.nodes.map((n: any) => ({ type: n.type, table: n.data?.table })))

    if (tables.length === 0) {
      console.log('No tables found in SQL, returning original')
      return sql // No tables found in SQL
    }

    // Find matching table nodes in the schema
    const matchingNodes = schemaData.graphJson.nodes.filter((node: any) => 
      node.type === 'table' && tables.includes(node.data.table.toLowerCase())
    )

    console.log('Matching nodes found:', matchingNodes.length)

    if (matchingNodes.length === 0) {
      console.log('No matching tables found in schema, returning original')
      return sql // No matching tables found
    }

    // Get the first matching table for context
    const firstNode = matchingNodes[0]
    const tableName = firstNode.data.table.toLowerCase()
    const tableData = firstNode.data.data

    // Check if this table has actual data stored in the schema
    if (tableData && Array.isArray(tableData) && tableData.length > 0) {
      const firstRow = tableData[0]
      
      // Check if this looks like a data structure
      if (typeof firstRow === 'object' && firstRow !== null) {
        
        // Retry loop to get correct SQL conversion
        let attempts = 0
        const maxAttempts = 3
        let lastError = ''
        let basePrompt = `You are a PostgreSQL expert specializing in JSONB queries.

TASK: Convert the following SQL query to work with schema data stored in JSONB format.

ORIGINAL SQL:
${sql}

SCHEMA STRUCTURE:
- Schema ID: ${schemaId}
- Table Name: ${tableName}
- Data is stored in: schemas.graphJson.nodes[].data.data[]
- Sample data structure: ${JSON.stringify(firstRow, null, 2)}

REQUIREMENTS:
1. Convert the query to use the schemas table with JSONB operations
2. Use CROSS JOIN LATERAL with jsonb_array_elements to extract data
3. Filter by schema ID and table name
4. Handle all column references with proper JSONB field access (rec->>'column_name')
5. Cast numeric fields appropriately (::numeric for numbers)
6. Handle subqueries by converting them to use the same schema structure
7. Remove table aliases from column references
8. Maintain all original logic (WHERE, ORDER BY, LIMIT, etc.)
9. For subqueries, use different aliases (s2, node2, rec2) to avoid conflicts
10. Ensure all WHERE clauses in subqueries use proper table prefixes (s2.id, not just id)

CRITICAL RULES:
- Subqueries must use s2.id = '${schemaId}' not just id = '${schemaId}'
- Column names in subqueries should be simple (e.g., 'density' not 'AVG(density)')
- Avoid nested function calls in JSONB field access
- Each subquery should be self-contained with proper FROM and WHERE clauses

OUTPUT FORMAT:
Return ONLY the converted SQL query, no explanations or markdown formatting.

EXAMPLE CONVERSION:
Original: SELECT p.district_name, p.population FROM people p WHERE p.density > (SELECT AVG(density) FROM people)
Converted: SELECT rec->>'district_name' AS district_name, (rec->>'population')::numeric AS population FROM schemas s CROSS JOIN LATERAL jsonb_array_elements(s."graphJson"->'nodes') AS node CROSS JOIN LATERAL jsonb_array_elements(node->'data'->'data') AS rec WHERE s.id = '${schemaId}' AND node->'data'->>'table' = '${tableName}' AND (rec->>'density')::numeric > (SELECT AVG((rec2->>'density')::numeric) FROM schemas s2 CROSS JOIN LATERAL jsonb_array_elements(s2."graphJson"->'nodes') AS node2 CROSS JOIN LATERAL jsonb_array_elements(node2->'data'->'data') AS rec2 WHERE s2.id = '${schemaId}' AND node2->'data'->>'table' = '${tableName}')`
        
        while (attempts < maxAttempts) {
          attempts++
          console.log(`SQL conversion attempt ${attempts}/${maxAttempts}`)
          
          try {
            // Use OpenAI to convert the SQL to JSONB query
            let conversionPrompt = basePrompt

            const conversionResponse = await openai.chat.completions.create({
              model: CHAT_MODEL_DEFAULT,
              temperature: 0.1,
              messages: [
                { role: 'system', content: 'You are a PostgreSQL JSONB expert. Convert SQL queries to work with JSONB schema data. Be precise and avoid nested function calls.' },
                { role: 'user', content: conversionPrompt }
              ],
            })

            const convertedSQL = conversionResponse.choices[0].message.content?.trim() || sql
            console.log(`Attempt ${attempts} - OpenAI converted SQL:`, convertedSQL)
            
            // Test the SQL by trying to execute it
            const testResult = await executeSQLQuery(convertedSQL)
            
            if (!testResult.error) {
              console.log(`✅ SQL conversion successful on attempt ${attempts}`)
              return convertedSQL
            } else {
              lastError = testResult.error
              console.log(`❌ Attempt ${attempts} failed:`, testResult.error)
              
              // If this is not the last attempt, add error context for next attempt
              if (attempts < maxAttempts) {
                basePrompt += `\n\nPREVIOUS ATTEMPT FAILED WITH ERROR: ${testResult.error}\nPlease fix the SQL and try again.`
              }
            }
            
          } catch (conversionError: any) {
            lastError = conversionError.message
            console.log(`❌ Conversion attempt ${attempts} error:`, conversionError.message)
          }
        }
        
        // If all attempts failed, return original SQL
        console.log(`❌ All ${maxAttempts} conversion attempts failed. Last error: ${lastError}`)
        return sql
      }
    }

    return sql // Return original SQL if no conversion needed
    
  } catch (error) {
    console.error('Error converting to schema data query:', error)
    return sql // Return original SQL on error
  }
}



// Build user prompt with context
function buildUserPrompt(question: string, contextSnips: Array<{text: string, payload: any, score: number}>): string {
  const ctx = contextSnips.map((s, i) => 
    `#${i+1} (${s.payload?.kind || '?'}) ${s.payload?.table || '?'}${s.payload?.kind === 'column' ? '.' + s.payload?.column : ''}\n${s.text}`
  ).join('\n\n')
  
  const joinHints = contextSnips
    .filter(s => s.payload?.kind === 'column' && s.payload?.isForeignKey)
    .map(s => {
      const ref = s.payload?.references || {}
      if (s.payload?.table && s.payload?.column && ref?.table && ref?.column) {
        return `${s.payload.table}.${s.payload.column} = ${ref.table}.${ref.column}`
      }
      return null
    })
    .filter(Boolean)
  
  const hintsBlock = joinHints.length > 0 
    ? `Join Hints (from FK metadata):\n${joinHints.map(h => `- ${h}`).join('\n')}`
    : 'Join Hints (from FK metadata):\n(none)'
  
  return `${hintsBlock}\n\nContext (top matches):\n${ctx}\n\nUser question:\n${question}\n\nProduce valid PostgreSQL SQL:`
}

// Extract SQL from response
function extractSql(text: string): string {
  // First try to extract from SQL code blocks
  const sqlMatch = text.match(/```sql\s*([\s\S]*?)\s*```/i)
  if (sqlMatch) {
    return sqlMatch[1].trim()
  }
  
  // Try to extract from generic code blocks
  const codeMatch = text.match(/```\s*([\s\S]*?)\s*```/)
  if (codeMatch) {
    return codeMatch[1].trim()
  }
  
  // Try to extract SQL after "Generated SQL:" or similar patterns
  const generatedMatch = text.match(/(?:Generated SQL|SQL):\s*([\s\S]*?)(?:\n\n|\nSummary|\nReasoning|$)/i)
  if (generatedMatch) {
    return generatedMatch[1].trim()
  }
  
  // If no patterns match, return the whole text trimmed
  return text.trim()
}

// Save chat message
async function saveChatMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string, metadata?: any) {
  try {
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
        metadata: metadata || {}
      }
    })
  } catch (error) {
    console.error('Error saving chat message:', error)
  }
}

// Get chat history
async function getChatHistory(sessionId: string, limit: number = 10) {
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
    
    return messages.reverse().map(msg => ({
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata,
      created_at: msg.createdAt
    }))
  } catch (error) {
    console.error('Error getting chat history:', error)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AskBody = await request.json()
    const { question, topK = 8, minScore = 0.2, chatModel = CHAT_MODEL_DEFAULT, sessionId, schemaId } = body
    
    if (!question || question.trim().length < 3) {
      return NextResponse.json(
        { error: 'Question must be at least 3 characters long' },
        { status: 400 }
      )
    }
    
    // Save user message
    if (sessionId) {
      await saveChatMessage(sessionId, 'user', question)
    }
    
    // 1) Load RAG docs
    const ragDocs = await fetchRagDocs()
    if (ragDocs.length === 0) {
      return NextResponse.json(
        { error: 'No schema documentation found. Please index your schema first.' },
        { status: 404 }
      )
    }
    
    // 2) Retrieve top-K by similarity
    let topSnips: Array<{text: string, payload: any, score: number}> = []
    
    if (ragDocs[0].embedding) {
      // Use vector similarity if embeddings are available
      try {
        const queryEmbedding = await getEmbedding(question)
        
        const similarities = ragDocs.map(doc => {
          if (!doc.embedding) return { doc, score: 0 }
          
          try {
            const docEmbedding = JSON.parse(doc.embedding)
            const score = cosineSimilarity(queryEmbedding, docEmbedding)
            return { doc, score }
          } catch {
            return { doc, score: 0 }
          }
        })
        
        const filtered = similarities
          .filter(s => s.score >= minScore)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
        
        topSnips = filtered.map(s => ({
          text: s.doc.text,
          payload: s.doc.payload,
          score: s.score
        }))
      } catch (error) {
        console.error('Error with vector similarity:', error)
        // Fallback to text similarity
      }
    }
    
    // Fallback to text similarity if no embeddings or vector similarity failed
    if (topSnips.length === 0) {
      const similarities = ragDocs.map(doc => ({
        doc,
        score: calculateTextSimilarity(question, doc.text)
      }))
      
      const filtered = similarities
        .filter(s => s.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
      
      topSnips = filtered.map(s => ({
        text: s.doc.text,
        payload: s.doc.payload,
        score: s.score
      }))
    }
    
    if (topSnips.length === 0) {
      return NextResponse.json(
        { error: 'No sufficiently similar schema snippets found.' },
        { status: 422 }
      )
    }
    
    // 2b) Augment context with FK columns
    const involvedTables = new Set(
      topSnips.map(s => s.payload?.table).filter(Boolean)
    )
    
    const fkSnips: Array<{text: string, payload: any, score: number}> = []
    const seenKeys = new Set<string>()
    
    for (const doc of ragDocs) {
      if (doc.payload?.kind === 'column' && 
          doc.payload?.isForeignKey && 
          involvedTables.has(doc.payload?.table)) {
        const key = `${doc.payload.table}.${doc.payload.column}`
        if (!seenKeys.has(key)) {
          fkSnips.push({
            text: doc.text,
            payload: doc.payload,
            score: 1.0
          })
          seenKeys.add(key)
        }
      }
    }
    
    const contextSnips = [...fkSnips, ...topSnips]
    
    // 3) Get chat history for context
    let chatHistory: Array<{role: string, content: string}> = []
    if (sessionId) {
      const history = await getChatHistory(sessionId, 6)
      chatHistory = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    }
    
    // 4) Ask OpenAI to generate SQL
    const userPrompt = buildUserPrompt(question, contextSnips)
    
    const messages = [
      { role: 'system', content: SQL_SYSTEM_PROMPT },
      ...chatHistory.slice(-4), // Include last 4 messages for context
      { role: 'user', content: userPrompt }
    ]
    
    const chat = await openai.chat.completions.create({
      model: chatModel,
      temperature: 0.1,
      messages: messages as any,
    })
    
    const raw = chat.choices[0].message.content || ''
    const sql = extractSql(raw)
    
    // 5) Get schema data and convert SQL to JSONB format
    let schemaData = null
    
    // Try to get schema by ID first, then fallback to sessionId
    if (schemaId) {
      schemaData = await getSchemaById(schemaId)
    }
    
    if (!schemaData && sessionId) {
      schemaData = await getCurrentSchema(sessionId)
    }
    
    // Debug: Log schema structure and actual tables
    console.log('Schema data:', JSON.stringify(schemaData, null, 2))
    const actualTables = await getActualTables()
    console.log('Actual tables in database:', actualTables)
    console.log('Schema ID:', schemaId)
    
    // Convert OpenAI generated SQL to query schema data from schemas table using OpenAI
    const executableSQL = await convertToSchemaDataQuery(sql, schemaData, schemaId || '')
    console.log('OpenAI Converted SQL:', executableSQL)
    
    // Execute SQL query directly against the database
    const { result, columns, error: sqlError } = await executeSQLQuery(executableSQL)
    
    // If SQL execution failed, try with original SQL as fallback
    if (sqlError) {
      console.warn('JSONB SQL failed, trying original SQL:', sqlError)
      const { result: fallbackResult, columns: fallbackColumns, error: fallbackError } = await executeSQLQuery(sql)
      
      if (fallbackError) {
        console.error('Both SQL queries failed:', fallbackError)
        return NextResponse.json(
          { 
            error: 'SQL execution failed', 
            details: fallbackError,
            debug: {
              originalSQL: sql,
              convertedSQL: executableSQL,
              actualTables: actualTables,
              schemaTables: schemaData?.graphJson?.nodes?.map((n: any) => n.data?.table).filter(Boolean) || []
            }
          },
          { status: 500 }
        )
      }
      
      // Use fallback results
      const finalResult = fallbackResult
      const finalColumns = fallbackColumns
      const finalSQL = sql
      
      // Continue with fallback results...
      const response = {
        ok: true,
        sql: finalSQL,
        executableSQL: executableSQL,
        sqlError: sqlError,
        used: contextSnips.map(s => ({
          key: `${s.payload?.table || '?'}${s.payload?.kind === 'column' ? '.' + s.payload?.column : ''}`,
          score: s.score,
          kind: s.payload?.kind,
          table: s.payload?.table,
          isForeignKey: s.payload?.isForeignKey || false,
          description: s.text,
        })),
        resultCount: finalResult.length,
        columns: finalColumns,
        result: finalResult,
        reasoning: '',
        sql_rationale: '',
        suggestions: '',
        summary: '',
        simulated: false,
      }
      
      return NextResponse.json(response)
    }
    
    // 6) Generate explanation and summary using OpenAI
    const explainPrompt = `You are an AI data assistant helping users understand and improve automatically generated SQL.

User question:
${question}

Selected schema elements (FKs prefixed) with similarity score if any:
${contextSnips.map(s => 
  `- ${s.payload?.table || '?'}${s.payload?.kind === 'column' ? '.' + s.payload?.column : ''}${s.payload?.isForeignKey ? ' [FK]' : ''}${s.score ? ` (${s.score.toFixed(3)})` : ''}: ${s.text.replace(/\n/g, ' ')}`
).join('\n')}

Generated SQL:
${executableSQL}

Now explain:
1. Why each table and column was selected (especially join keys).
2. Why the SQL was structured as it is (joins, filters, projections).
3. Suggestions to improve schema descriptions or the prompt.

Return a short JSON object with keys: reasoning, sql_rationale, suggestions.`
    
    const analysis = await openai.chat.completions.create({
      model: chatModel,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You are an analytical assistant for RAG-based SQL generation.' },
        { role: 'user', content: explainPrompt }
      ],
      response_format: { type: 'json_object' },
    })
    
    let parsed: any = {}
    try {
      parsed = JSON.parse(analysis.choices[0].message.content || '{}')
    } catch {
      parsed = {}
    }
    
    const reasoning = parsed.reasoning || ''
    const sqlRationale = parsed.sql_rationale || ''
    const suggestions = parsed.suggestions || ''
    
    // 7) Generate summary
    let summary = ''
    try {
      const preview = result.slice(0, 20)
      const jsonPreview = JSON.stringify(preview, null, 2)
      
      const summaryPrompt = `You are a data analyst. Summarize the query result in concise English. Mention key patterns, trends, or anomalies.

SQL:
${executableSQL}

Result (first 20 rows):
${jsonPreview}`
      
      const summaryResp = await openai.chat.completions.create({
        model: chatModel,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a concise data summarizer.' },
          { role: 'user', content: summaryPrompt }
        ],
      })
      
      summary = summaryResp.choices[0].message.content?.trim() || ''
    } catch (error) {
      console.error('Error generating summary:', error)
    }
    
    // Save assistant response
    if (sessionId) {
      await saveChatMessage(sessionId, 'assistant', 
        '', // Empty content since we'll render with accordions
        {
          sql,
          executableSQL,
          resultCount: result.length,
          columns,
          result: result.slice(0, 20), // Limit to first 20 rows
          used: contextSnips.map(s => ({
            key: `${s.payload?.table || '?'}${s.payload?.kind === 'column' ? '.' + s.payload?.column : ''}`,
            score: s.score,
            kind: s.payload?.kind,
            table: s.payload?.table,
            isForeignKey: s.payload?.isForeignKey || false,
            isPrimaryKey: s.payload?.isPrimaryKey || false,
            description: s.text,
          })),
          summary,
          reasoning,
          sql_rationale: sqlRationale,
          suggestions,
          simulated: false
        }
      )
    }
    
    const response = {
      ok: true,
      sql,
      executableSQL,
      used: contextSnips.map(s => ({
        key: `${s.payload?.table || '?'}${s.payload?.kind === 'column' ? '.' + s.payload?.column : ''}`,
        score: s.score,
        kind: s.payload?.kind,
        table: s.payload?.table,
        isForeignKey: s.payload?.isForeignKey || false,
        description: s.text,
      })),
      resultCount: result.length,
      columns,
      result,
      reasoning,
      sql_rationale: sqlRationale,
      suggestions,
      summary,
      simulated: false, // Using real database execution
    }
    
    return NextResponse.json(response)
    
  } catch (error: any) {
    console.error('AI Ask error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}