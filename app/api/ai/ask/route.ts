// app/api/ask/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

/** ---------- OpenAI Setup ---------- */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

const EMBED_MODEL = process.env.EMBED_MODEL_NAME || 'text-embedding-3-large'
const CHAT_MODEL_DEFAULT = process.env.CHAT_MODEL || 'gpt-4o-mini'

/** ---------- System Prompts ---------- */
/** (A) Plain-Table SQL from RAG (imagined physical tables) */
const SQL_SYSTEM_PROMPT = `You are a precise SQL generator for PostgreSQL.

Rules:
- Output a single SQL code block without commentary.
- Use table and column names exactly as provided by the context.
- When joining, follow the Foreign-Key Join Hints exactly (e.g., nature.district_name = adm.district).
- Prefer ANSI SQL compatible with PostgreSQL.
- If dates are strings, cast only when necessary.
- If a query is ambiguous, make the most reasonable minimal assumption.
- Do not invent tables or columns.
- IMPORTANT: Assume the schema exists as PHYSICAL TABLES (not JSON).
- DO NOT reference public."schemas" or "graphJson" here.`

/** (B) JSON-Graph SQL that reads from public."schemas"."graphJson" */
const SQL_SYSTEM_PROMPT_JSON_GRAPH = `
You are a precise SQL generator for PostgreSQL that reads a JSON graph stored in public."schemas"."graphJson" (jsonb).

Graph shape:
{
  "nodes": [
    {
      "id": "table-1",
      "type": "table",
      "data": {
        "table": "<table_name>",
        "columns": [ { "name": "...", "type": "...", ... }, ... ],
        "data": [ { "<col>": <val>, ... }, ... ]
      }
    }
  ],
  "edges": [
    {
      "source": "<table-node-id>",
      "target": "<table-node-id>",
      "sourceHandle": "<table>__<column>__out",
      "targetHandle": "<table>__<column>__in"
    }
  ]
}

Rules:
- Output a single SQL code block without commentary.
- Always start with these CTEs (exact spellings):

  WITH src AS (
    SELECT "graphJson"::jsonb AS j
    FROM public."schemas"
    WHERE id = $SCHEMA_ID$
  ),
  rows AS (
    SELECT (n->'data'->>'table') AS table_name,
           jsonb_array_elements(n->'data'->'data') AS row
    FROM src s
    CROSS JOIN LATERAL jsonb_array_elements(s.j->'nodes') n
    WHERE n->>'type' = 'table'
  )

- NEVER use SELECT *; always enumerate columns.
- Use REAL column names from the data; when present in RAG hints, prefer those exact names.
- Alias any colliding names to be unambiguous in the final SELECT:
  users.created_at       AS user_created_at
  comments.created_at    AS comment_created_at
  posts.created_at       AS post_created_at

- Prefer obvious FK joins (e.g., comments.post_id = posts.id). If ambiguous, derive from edges:
  - sourceHandle/targetHandle format: "<table>__<column>__out|in"
  - Only use join pairs that exist in the data.
- Use explicit casts only when necessary (e.g., ::int for numeric ids).
- Do not invent table or column names.
- End with a single SELECT.`

/** Reviewer prompt that focuses on PROMPT & DATA (not SQL/JSON formats) */
const REVIEW_SYSTEM_PROMPT = `
You are a concise reviewer.

Your job:
- Summarize what the result set gives in terms of the user's question (focus on entities/fields from the prompt).
- Offer short, practical suggestions to better satisfy the prompt using available data (filters, fields, grouping), not formatting advice.
- Explain WHY this SQL is justified by (1) signals in the user prompt and (2) evidence from the available schema/data,
  including key join reasons from FK hints.

Return STRICT JSON with this shape:

{
  "summary": "1–3 sentences about the returned data, referencing user-intent and fields.",
  "suggestions": ["concise, actionable changes based on prompt & data (e.g., add filter by published=true)", "..."],
  "derivation": {
    "from_prompt": ["which entities/fields/constraints the prompt implies", "..."],
    "from_data": ["which tables/columns exist and match the prompt terms", "..."],
    "join_logic": ["explain the chosen joins using FK hints", "..."]
  }
}

DO NOT talk about SQL/JSON formatting or engine details.
DO NOT include backticks or extra text.`

/** ---------- Types ---------- */
interface AskBody {
  question: string
  topK?: number
  minScore?: number
  chatModel?: string
  useGraphJson?: boolean   // default TRUE (affects final SQL + execution)
  schemaId?: string
  execute?: boolean        // default TRUE (executes final SQL)
}

/** ---------- Similarity Helpers ---------- */
function calculateTextSimilarity(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)
  const textWords = text.toLowerCase().split(/\s+/)
  if (queryWords.length === 0) return 0
  let matches = 0
  for (const w of queryWords) if (textWords.includes(w)) matches++
  return matches / queryWords.length
}

async function getEmbedding(text: string): Promise<number[]> {
  const resp = await openai.embeddings.create({ model: EMBED_MODEL, input: text })
  return resp.data[0].embedding
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i] }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** ---------- RAG Docs ---------- */
async function fetchRagDocs() {
  try {
    const docs = await prisma.ragDoc.findMany({ orderBy: { id: 'asc' } })
    return docs.map((doc: any) => ({
      id: doc.id,
      text: doc.text as string,
      payload: doc.payload as any,
      embedding: doc.embedding as string | null,
    }))
  } catch (e) {
    console.error('Error fetching RAG docs:', e)
    return []
  }
}

/** ---------- Prompt Builders ---------- */
function buildUserPrompt(
  question: string,
  contextSnips: Array<{ text: string; payload: any; score: number }>
): string {
  const ctx = contextSnips
    .map((s, i) => `#${i + 1} (${s.payload?.kind || '?'}) ${s.payload?.table || '?'}${s.payload?.kind === 'column' ? '.' + s.payload?.column : ''}\n${s.text}`)
    .join('\n\n')

  const joinHints = contextSnips
    .filter(s => s.payload?.kind === 'column' && s.payload?.isForeignKey)
    .map(s => {
      const ref = s.payload?.references || {}
      if (s.payload?.table && s.payload?.column && ref?.table && ref?.column) {
        return `${s.payload.table}.${s.payload.column} = ${ref.table}.${ref.column}`
      }
      return null
    })
    .filter(Boolean) as string[]

  const hintsBlock =
    joinHints.length > 0
      ? `Foreign-Key Join Hints:\n${joinHints.map(h => `- ${h}`).join('\n')}`
      : 'Foreign-Key Join Hints:\n(none)'

  return `${hintsBlock}\n\nContext (top matches):\n${ctx}\n\nUser question:\n${question}\n\nProduce valid PostgreSQL SQL:`
}

/** Build column hints from RAG (prevents wrong names like body/content mixups) */
function buildColumnHints(contextSnips: Array<{ text: string; payload: any; score: number }>) {
  const byTable: Record<string, Set<string>> = {}
  for (const s of contextSnips) {
    const t = s.payload?.table
    const c = s.payload?.column
    if (!t || !c) continue
    if (!byTable[t]) byTable[t] = new Set()
    byTable[t].add(c)
  }
  const lines: string[] = []
  for (const [t, cols] of Object.entries(byTable)) {
    lines.push(`- ${t}: ${Array.from(cols).sort().join(', ')}`)
  }
  // Explicit reminders for your dataset
  const reminders = [
    `Examples from data:`,
    `- posts has "content" (NOT "body")`,
    `- comments has "text" (NOT "content")`,
    `- users has "created_at"`,
  ]
  return lines.length
    ? `Column Map Hints:\n${lines.join('\n')}\n\n${reminders.join('\n')}`
    : `Column Map Hints:\n(none)\n\n${reminders.join('\n')}`
}

/** ---------- SQL Extraction & Safety ---------- */
function extractSql(text: string): string {
  const sqlBlock = text.match(/```sql\s*([\s\S]*?)\s*```/i)
  if (sqlBlock) return sqlBlock[1].trim()
  const anyBlock = text.match(/```\s*([\s\S]*?)\s*```/)
  if (anyBlock) return anyBlock[1].trim()
  const afterLabel = text.match(/(?:Generated SQL|SQL):\s*([\s\S]*?)(?:\n\n|\nSummary|\nReasoning|$)/i)
  if (afterLabel) return afterLabel[1].trim()
  return text.trim()
}

function isSelectOnly(sql: string): boolean {
  const t = sql.trim().toLowerCase()
  const startsOk = t.startsWith('with') || t.startsWith('select')
  const forbidden = /(insert|update|delete|alter|drop|truncate|create|grant|revoke|comment|vacuum|analyze|refresh\s+materialized\s+view)\b/i.test(sql)
  return startsOk && !forbidden
}

function targetsJsonGraph(sql: string): boolean {
  return /\bWITH\s+src\s+AS\s*\(\s*SELECT\s+"graphJson"::jsonb\s+AS\s+j\s+FROM\s+public\."schemas"\s+WHERE\s+id\s*=\s*\$SCHEMA_ID\$\s*\)\s*,\s*rows\s+AS\s*\(/i.test(sql)
}

function mentionsGraphJson(sql: string): boolean {
  return /public\."schemas"|graphjson/i.test(sql)
}

function usesSelectStar(sql: string): boolean {
  return /\bselect\b[^;]*\*/i.test(sql)
}

function safeJsonParse<T>(s: string): T | null {
  try { return JSON.parse(s) as T } catch { return null }
}

/** ---------- Route Handler ---------- */
export async function POST(request: NextRequest) {
  try {
    const body: AskBody = await request.json()
    const {
      question,
      topK = 8,
      minScore = 0.2,
      chatModel = CHAT_MODEL_DEFAULT,
      // defaults per your request
      useGraphJson = true,
      schemaId,
      execute = true,
    } = body

    if (!question || question.trim().length < 3) {
      return NextResponse.json({ error: 'Question must be at least 3 characters long' }, { status: 400 })
    }
    if (useGraphJson && !schemaId) {
      return NextResponse.json({ error: 'schemaId is required when useGraphJson is true' }, { status: 400 })
    }

    // (1) Load RAG docs
    const ragDocs = await fetchRagDocs()
    if (ragDocs.length === 0) {
      return NextResponse.json(
        { error: 'No schema documentation found. Please index your schema first.' },
        { status: 404 }
      )
    }

    // (2) Retrieve top-K by similarity
    let topSnips: Array<{ text: string; payload: any; score: number }> = []

    if (ragDocs[0].embedding) {
      try {
        const queryEmbedding = await getEmbedding(question)
        const sims = ragDocs.map(doc => {
          try {
            const emb = doc.embedding ? JSON.parse(doc.embedding) as number[] : null
            const score = emb ? cosineSimilarity(queryEmbedding, emb) : 0
            return { doc, score }
          } catch {
            return { doc, score: 0 }
          }
        })
        const filtered = sims
          .filter(s => s.score >= minScore)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
        topSnips = filtered.map(s => ({ text: s.doc.text, payload: s.doc.payload, score: s.score }))
      } catch (e) {
        console.error('Vector similarity failed, falling back to text similarity:', e)
      }
    }

    if (topSnips.length === 0) {
      const sims = ragDocs.map(doc => ({
        doc,
        score: calculateTextSimilarity(question, doc.text),
      }))
      const filtered = sims
        .filter(s => s.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
      topSnips = filtered.map(s => ({ text: s.doc.text, payload: s.doc.payload, score: s.score }))
    }

    if (topSnips.length === 0) {
      return NextResponse.json({ error: 'No sufficiently similar schema snippets found.' }, { status: 422 })
    }

    // (2b) Augment with FK columns from involved tables
    const involvedTables = new Set(topSnips.map(s => s.payload?.table).filter(Boolean))
    const fkSnips: Array<{ text: string; payload: any; score: number }> = []
    const seen = new Set<string>()

    for (const doc of ragDocs) {
      if (
        doc.payload?.kind === 'column' &&
        doc.payload?.isForeignKey &&
        involvedTables.has(doc.payload?.table)
      ) {
        const key = `${doc.payload.table}.${doc.payload.column}`
        if (!seen.has(key)) {
          fkSnips.push({ text: doc.text, payload: doc.payload, score: 1.0 })
          seen.add(key)
        }
      }
    }
    const contextSnips = [...fkSnips, ...topSnips]
    const columnHints = buildColumnHints(contextSnips)

    /** (3) INITIAL SQL (PLAIN TABLE) */
    const messagesInitial = [
      { role: 'system', content: SQL_SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(question, contextSnips) },
    ] as const

    const chatInitial = await openai.chat.completions.create({
      model: chatModel,
      temperature: 0.1,
      messages: messagesInitial as any,
    })
    let sql_initial = extractSql(chatInitial.choices?.[0]?.message?.content || '')

    // Guard: initial must NOT reference graphJson/public."schemas"
    if (mentionsGraphJson(sql_initial) || sql_initial.trim().length === 0) {
      const retry = await openai.chat.completions.create({
        model: chatModel,
        temperature: 0.1,
        messages: [
          ...messagesInitial,
          { role: 'user', content: 'Regenerate for PHYSICAL tables only. DO NOT reference public."schemas" or "graphJson".' }
        ] as any,
      })
      sql_initial = extractSql(retry.choices?.[0]?.message?.content || sql_initial)
    }

    /** (4) FINAL SQL (JSON GRAPH) — translate the initial into graphJson form with strict constraints */
    let sql_final = sql_initial
    if (useGraphJson) {
      const messagesFinal = [
        { role: 'system', content: SQL_SYSTEM_PROMPT_JSON_GRAPH },
        {
          role: 'user',
          content:
`Translate the following plain-table SQL to read from public."schemas"."graphJson" using the mandatory src/rows CTEs.
STRICTLY follow these constraints:
- DO NOT use SELECT *; enumerate columns.
- Use the exact column names from hints.
- Map the following collisions with aliases:
  users.created_at AS user_created_at
  comments.created_at AS comment_created_at
  posts.created_at AS post_created_at
- If a column doesn't exist in the hints/data, do NOT include it.

SCHEMA_ID: ${schemaId}

${columnHints}

PLAIN SQL:
${sql_initial}
`
        }
      ] as const

      const chatFinal = await openai.chat.completions.create({
        model: chatModel,
        temperature: 0.1,
        messages: messagesFinal as any,
      })
      sql_final = extractSql(chatFinal.choices?.[0]?.message?.content || '')

      // Ensure it targets graphJson and avoids SELECT *
      if (!targetsJsonGraph(sql_final) || usesSelectStar(sql_final)) {
        const retry = await openai.chat.completions.create({
          model: chatModel,
          temperature: 0.1,
          messages: [
            ...messagesFinal,
            { role: 'user', content: 'The SQL must START with src and rows CTEs using graphJson, and MUST NOT use SELECT *. Regenerate exactly as instructed.' }
          ] as any,
        })
        sql_final = extractSql(retry.choices?.[0]?.message?.content || sql_final)
      }

      // Substitute schema token
      if (schemaId) {
        sql_final = sql_final.replace(/\$SCHEMA_ID\$/g, `'${schemaId.replace(/'/g, "''")}'`)
      }
    }

    /** (5) Execute FINAL SQL (SELECT-only) */
    let rows: unknown[] | undefined
    let execError: string | undefined
    let executed = false

    if (execute) {
      try {
        const candidate = sql_final
        if (!isSelectOnly(candidate)) {
          throw new Error('Generated SQL rejected by safety check (SELECT/CTE only).')
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await prisma.$queryRawUnsafe(candidate)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        rows = Array.isArray(result) ? result as unknown[] : []
        executed = true
      } catch (e: any) {
        execError = e?.message || 'Failed to execute SQL'
      }
    }

    /** (6) Reviewer summary/suggestions/DERIVATION (prompt+data evidence, no format talk) */
    let summary: string | undefined
    let suggestions: string[] | undefined
    let derivation:
      | { from_prompt: string[]; from_data: string[]; join_logic: string[] }
      | undefined

    try {
      const joinHintsOnly = contextSnips
        .filter(s => s.payload?.kind === 'column' && s.payload?.isForeignKey)
        .map(s => {
          const ref = s.payload?.references || {}
          if (s.payload?.table && s.payload?.column && ref?.table && ref?.column) {
            return `${s.payload.table}.${s.payload.column} = ${ref.table}.${ref.column}`
          }
          return null
        })
        .filter(Boolean) as string[]

      const usedBrief = contextSnips.slice(0, 16).map(s => {
        const key = `${s.payload?.table || '?'}${s.payload?.kind === 'column' ? '.' + s.payload?.column : ''}`
        return `- ${key}: ${s.text?.split('\n').slice(0,2).join(' ')}`
      }).join('\n')

      const review = await openai.chat.completions.create({
        model: chatModel,
        temperature: 0.2,
        messages: [
          { role: 'system', content: REVIEW_SYSTEM_PROMPT },
          { role: 'user', content:
`User question:
${question}

Initial SQL (plain-table):
${sql_initial}

Final SQL (JSON-graph):
${sql_final}

Foreign-key hints detected:
${joinHintsOnly.length ? joinHintsOnly.map(h => `- ${h}`).join('\n') : '(none)'}

Column hints:
${columnHints}

Context (RAG snippets):
${usedBrief}
` }
        ] as any,
      })
      const blob = review.choices?.[0]?.message?.content?.trim() || '{}'
      const parsed = safeJsonParse<{
        summary: string
        suggestions: string[]
        derivation: { from_prompt: string[]; from_data: string[]; join_logic: string[] }
      }>(blob)

      summary = parsed?.summary
      suggestions = parsed?.suggestions
      derivation = parsed?.derivation
    } catch {}

    /** (7) Response */
    return NextResponse.json({
      ok: true,
      sql_initial,   // plain-table RAG SQL
      sql_final,     // JSONB graph SQL (no *, correct names, aliased collisions)
      executed,
      error: execError,
      rows,
      used: contextSnips.map(s => ({
        key: `${s.payload?.table || '?'}${s.payload?.kind === 'column' ? '.' + s.payload?.column : ''}`,
        score: s.score,
        kind: s.payload?.kind,
        table: s.payload?.table,
        isForeignKey: !!s.payload?.isForeignKey,
        description: s.text,
      })),
      summary,        // focuses on prompt + data
      suggestions,    // actionable improvements based on prompt & data
      derivation,     // WHY: evidence from prompt & data (tables/columns & join logic)
    })
  } catch (error: any) {
    console.error('AI Ask error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
