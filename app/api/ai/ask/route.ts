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

// Get current schema data for simulation
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

// Execute SQL on real data from schema nodes
function executeSQLOnRealData(sql: string, schemaData: any): { result: any[], columns: string[] } {
  try {
    // Extract table names from SQL (including JOINs)
    const tableMatches = sql.match(/\b(?:FROM|JOIN)\s+(\w+)/gi) || []
    const tables = tableMatches.map(match => match.replace(/(?:FROM|JOIN)\s+/i, '').toLowerCase())
    
    if (tables.length === 0) {
      return { result: [], columns: [] }
    }
    
    // Find matching tables in schema
    const schemaTables = schemaData?.graphJson?.nodes?.filter((node: any) => 
      node.type === 'table' && tables.includes(node.data.table.toLowerCase())
    ) || []
    
    if (schemaTables.length === 0) {
      return { result: [], columns: [] }
    }
    
    // Get real data from each table
    const tableData: { [key: string]: any[] } = {}
    const tableColumns: { [key: string]: string[] } = {}
    
    for (const tableNode of schemaTables) {
      const tableName = tableNode.data.table.toLowerCase()
      tableData[tableName] = tableNode.data.data || [] // Use real data from node
      tableColumns[tableName] = tableNode.data.columns.map((col: any) => col.name)
    }
    
    // Handle JOIN operations
    if (sql.toLowerCase().includes('join')) {
      return executeJoinQuery(sql, tableData, tableColumns)
    }
    
    // Simple SQL execution based on query type
    if (sql.toLowerCase().includes('select')) {
      // For SELECT queries, return real data
      const firstTable = tables[0]
      let data = tableData[firstTable] || []
      const columns = tableColumns[firstTable] || []
      
      // Apply simple WHERE conditions if present
      const whereMatch = sql.match(/WHERE\s+(.+)/i)
      if (whereMatch) {
        const whereClause = whereMatch[1].toLowerCase()
        // Simple filtering based on common patterns
        if (whereClause.includes('id =')) {
          const idMatch = whereClause.match(/id\s*=\s*(\d+)/)
          if (idMatch) {
            const targetId = parseInt(idMatch[1])
            data = data.filter(row => row.id === targetId)
          }
        }
      }
      
      // Apply LIMIT if present
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
      if (limitMatch) {
        const limit = parseInt(limitMatch[1])
        data = data.slice(0, limit)
      }
      
      return { result: data, columns }
    }
    
    // For other query types, return empty result
    return { result: [], columns: [] }
    
  } catch (error) {
    console.error('Error executing SQL on real data:', error)
    return { result: [], columns: [] }
  }
}

function executeJoinQuery(sql: string, tableData: { [key: string]: any[] }, tableColumns: { [key: string]: string[] }): { result: any[], columns: string[] } {
  try {
    // Extract JOIN information
    const joinMatch = sql.match(/(\w+)\s+(?:LEFT\s+)?JOIN\s+(\w+)\s+ON\s+([^;]+)/i)
    if (!joinMatch) {
      return { result: [], columns: [] }
    }
    
    const [, leftTable, rightTable, joinCondition] = joinMatch
    const leftTableName = leftTable.toLowerCase()
    const rightTableName = rightTable.toLowerCase()
    
    const leftData = tableData[leftTableName] || []
    const rightData = tableData[rightTableName] || []
    
    // Parse join condition (e.g., "posts.user_id = users.id")
    const joinConditionMatch = joinCondition.match(/(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/i)
    if (!joinConditionMatch) {
      return { result: [], columns: [] }
    }
    
    const [, leftTableAlias, leftColumn, rightTableAlias, rightColumn] = joinConditionMatch
    
    // The FROM table is always the left table, JOIN table is always the right table
    const actualLeftTable = leftTableName
    const actualRightTable = rightTableName
    const actualLeftData = leftData
    const actualRightData = rightData
    
    // Determine which column to use for joining based on the condition
    let actualLeftColumn: string
    let actualRightColumn: string
    
    if (leftTableAlias.toLowerCase() === leftTableName) {
      actualLeftColumn = leftColumn
      actualRightColumn = rightColumn
    } else {
      actualLeftColumn = rightColumn
      actualRightColumn = leftColumn
    }
    
    // Perform the JOIN
    const joinedResults: any[] = []
    
    for (const leftRow of actualLeftData) {
      const leftValue = leftRow[actualLeftColumn]
      
      // Find matching rows in right table
      const matchingRightRows = actualRightData.filter(rightRow => 
        rightRow[actualRightColumn] === leftValue
      )
      
      if (matchingRightRows.length > 0) {
        // Create joined rows with proper column prefixes
        for (const rightRow of matchingRightRows) {
          const joinedRow: any = {}
          
          // Add left table columns with prefix
          for (const col of tableColumns[actualLeftTable] || []) {
            joinedRow[`${actualLeftTable}.${col}`] = leftRow[col]
            // Also add without prefix for backward compatibility
            joinedRow[col] = leftRow[col]
          }
          
          // Add right table columns with prefix
          for (const col of tableColumns[actualRightTable] || []) {
            joinedRow[`${actualRightTable}.${col}`] = rightRow[col]
            // Only add without prefix if it doesn't conflict
            if (!joinedRow[col]) {
              joinedRow[col] = rightRow[col]
            }
          }
          
          joinedResults.push(joinedRow)
        }
      } else if (sql.toLowerCase().includes('left join')) {
        // For LEFT JOIN, include left row even if no match
        const joinedRow: any = {}
        
        // Add left table columns
        for (const col of tableColumns[actualLeftTable] || []) {
          joinedRow[`${actualLeftTable}.${col}`] = leftRow[col]
          joinedRow[col] = leftRow[col]
        }
        
        // Add null values for right table columns
        for (const col of tableColumns[actualRightTable] || []) {
          joinedRow[`${actualRightTable}.${col}`] = null
        }
        
        joinedResults.push(joinedRow)
      }
    }
    
    // Extract column names from SELECT clause
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i)
    let columns: string[] = []
    
    if (selectMatch) {
      const selectClause = selectMatch[1].trim()
      if (selectClause === '*') {
        // Include all columns from both tables
        columns = [
          ...(tableColumns[actualLeftTable] || []),
          ...(tableColumns[actualRightTable] || [])
        ]
      } else {
        // Parse specific columns
        const columnList = selectClause.split(',').map(col => col.trim())
        columns = columnList.map(col => {
          // Remove table prefix if present (e.g., "users.id" -> "id")
          const parts = col.split('.')
          return parts[parts.length - 1]
        })
      }
    }
    
    // Apply LIMIT if present
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
    if (limitMatch) {
      const limit = parseInt(limitMatch[1])
      joinedResults.splice(limit)
    }
    
    return { result: joinedResults, columns }
    
  } catch (error) {
    console.error('Error executing JOIN query:', error)
    return { result: [], columns: [] }
  }
}

// Generate sample data for a table based on its columns
function generateSampleData(tableData: any): any[] {
  const columns = tableData.columns || []
  const sampleRows = []
  
  // Generate 3-5 sample rows
  const rowCount = Math.floor(Math.random() * 3) + 3
  
  for (let i = 0; i < rowCount; i++) {
    const row: any = {}
    
    columns.forEach((col: any) => {
      const colName = col.name.toLowerCase()
      const colType = col.type?.toLowerCase() || 'varchar'
      
      if (colName.includes('id')) {
        row[col.name] = i + 1
      } else if (colType.includes('int') || colType.includes('number')) {
        row[col.name] = Math.floor(Math.random() * 1000) + 1
      } else if (colType.includes('date') || colType.includes('time')) {
        row[col.name] = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      } else if (colType.includes('bool')) {
        row[col.name] = Math.random() > 0.5
      } else {
        // String/varchar fields
        const sampleTexts = ['Sample', 'Test', 'Example', 'Demo', 'Data', 'Record', 'Item', 'Entry']
        row[col.name] = `${sampleTexts[Math.floor(Math.random() * sampleTexts.length)]} ${i + 1}`
      }
    })
    
    sampleRows.push(row)
  }
  
  return sampleRows
}

// Simulate SQL execution on schema data
function simulateSQLExecution(sql: string, schemaData: any): { result: any[], columns: string[] } {
  try {
    // Extract table names from SQL (simple regex)
    const tableMatches = sql.match(/\bFROM\s+(\w+)/gi) || []
    const tables = tableMatches.map(match => match.replace(/FROM\s+/i, '').toLowerCase())
    
    if (tables.length === 0) {
      return { result: [], columns: [] }
    }
    
    // Find matching tables in schema
    const schemaTables = schemaData?.graphJson?.nodes?.filter((node: any) => 
      node.type === 'table' && tables.includes(node.data.table.toLowerCase())
    ) || []
    
    if (schemaTables.length === 0) {
      return { result: [], columns: [] }
    }
    
    // Generate sample data for each table
    const tableData: { [key: string]: any[] } = {}
    const tableColumns: { [key: string]: string[] } = {}
    
    for (const tableNode of schemaTables) {
      const tableName = tableNode.data.table.toLowerCase()
      tableData[tableName] = generateSampleData(tableNode.data)
      tableColumns[tableName] = tableNode.data.columns.map((col: any) => col.name)
    }
    
    // Simple simulation based on SQL type
    if (sql.toLowerCase().includes('select')) {
      // For SELECT queries, return sample data
      const firstTable = tables[0]
      const data = tableData[firstTable] || []
      const columns = tableColumns[firstTable] || []
      
      // Apply simple WHERE conditions if present
      let filteredData = data
      const whereMatch = sql.match(/WHERE\s+(.+)/i)
      if (whereMatch) {
        const whereClause = whereMatch[1].toLowerCase()
        // Simple filtering based on common patterns
        if (whereClause.includes('id =')) {
          const idMatch = whereClause.match(/id\s*=\s*(\d+)/)
          if (idMatch) {
            const targetId = parseInt(idMatch[1])
            filteredData = data.filter(row => row.id === targetId)
          }
        }
      }
      
      // Apply LIMIT if present
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
      if (limitMatch) {
        const limit = parseInt(limitMatch[1])
        filteredData = filteredData.slice(0, limit)
      }
      
      return { result: filteredData, columns }
    }
    
    // For other query types, return empty result
    return { result: [], columns: [] }
    
  } catch (error) {
    console.error('Error simulating SQL:', error)
    return { result: [], columns: [] }
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
    const { question, topK = 8, minScore = 0.2, chatModel = CHAT_MODEL_DEFAULT, sessionId } = body
    
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
    
    // 5) Simulate SQL execution instead of real execution
    const schemaData = await getCurrentSchema(sessionId)
    // Execute SQL on real data from schema nodes
    const { result, columns } = executeSQLOnRealData(sql, schemaData)
    
    // 6) Generate explanation
    const explainPrompt = `You are an AI data assistant helping users understand and improve automatically generated SQL.

User question:
${question}

Selected schema elements (FKs prefixed) with similarity score if any:
${contextSnips.map(s => 
  `- ${s.payload?.table || '?'}${s.payload?.kind === 'column' ? '.' + s.payload?.column : ''}${s.payload?.isForeignKey ? ' [FK]' : ''}${s.score ? ` (${s.score.toFixed(3)})` : ''}: ${s.text.replace(/\n/g, ' ')}`
).join('\n')}

Generated SQL:
${sql}

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
${sql}

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
      simulated: false, // Using real data from schema nodes
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