import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EMBED_MODEL = process.env.EMBED_MODEL_NAME || 'text-embedding-3-large'

/* =========================
   Embeddings
   ========================= */
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

/* =========================
   Graph → RAG docs extraction
   ========================= */
type ColumnNode = {
  name: string
  type: 'text' | 'number' | 'boolean'
  description?: string
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  references?: { table: string; column?: string } | null
}

type TableNodeData = {
  table: string
  description?: string
  columns?: ColumnNode[]
  data?: Record<string, any>[]
}

function extractSchemaInfo(graphJson: any) {
  const docs: Array<{ text: string; payload: any }> = []
  if (!graphJson?.nodes) return docs

  const relationships: Array<{ from: string; to: string; fromColumn: string; toColumn: string }> = []

  for (const node of graphJson.nodes) {
    if (node.type === 'table' && node.data) {
      const tableData = node.data as TableNodeData
      if (!tableData?.table) continue

      let tableText = `Table: ${tableData.table}`
      if (tableData.description) tableText += `\nDescription: ${tableData.description}`

      if (tableData.columns && Array.isArray(tableData.columns)) {
        tableText += '\nColumns:'
        for (const column of tableData.columns) {
          tableText += `\n- ${column.name} (${column.type})`
          if (column.description) tableText += `: ${column.description}`
          if (column.isPrimaryKey) tableText += ' [PRIMARY KEY]'
          if (column.isForeignKey) {
            tableText += ' [FOREIGN KEY]'
            if (column.references) {
              tableText += ` -> ${column.references.table}.${column.references.column || 'id'}`
              relationships.push({
                from: tableData.table,
                to: column.references.table,
                fromColumn: column.name,
                toColumn: column.references.column || 'id',
              })
            }
          }
        }
      }

      if (tableData.data && Array.isArray(tableData.data) && tableData.data.length > 0) {
        tableText += `\nSample data: ${tableData.data.length} records`
        const sampleRecord = tableData.data[0]
        const sampleFields = Object.keys(sampleRecord).slice(0, 3)
        if (sampleFields.length > 0) {
          tableText += `\nExample: ${sampleFields.map((f) => `${f}=${sampleRecord[f]}`).join(', ')}`
        }
      }

      docs.push({
        text: tableText,
        payload: {
          kind: 'table',
          table: tableData.table,
          description: tableData.description,
          columnCount: tableData.columns?.length || 0,
          hasData: !!(tableData.data && tableData.data.length > 0),
          recordCount: tableData.data?.length || 0,
        },
      })

      if (tableData.columns && Array.isArray(tableData.columns)) {
        for (const column of tableData.columns) {
          let columnText = `Column: ${tableData.table}.${column.name}\nType: ${column.type}`
          if (column.description) columnText += `\nDescription: ${column.description}`
          if (column.isPrimaryKey) columnText += '\nRole: Primary Key - uniquely identifies each row'
          if (column.isForeignKey) {
            columnText += '\nRole: Foreign Key - references another table'
            if (column.references)
              columnText += `\nReferences: ${column.references.table}.${column.references.column || 'id'}`
          }
          if (column.type === 'text') columnText += '\nSQL Type: VARCHAR/TEXT - use for string operations'
          else if (column.type === 'number') columnText += '\nSQL Type: INTEGER/NUMERIC - use for mathematical operations'
          else if (column.type === 'boolean') columnText += '\nSQL Type: BOOLEAN - use for true/false conditions'

          docs.push({
            text: columnText,
            payload: {
              kind: 'column',
              table: tableData.table,
              column: column.name,
              type: column.type,
              description: column.description,
              isPrimaryKey: column.isPrimaryKey || false,
              isForeignKey: column.isForeignKey || false,
              references: column.references || null,
            },
          })
        }
      }
    }
  }

  for (const rel of relationships) {
    const relationshipText =
      `Relationship: ${rel.from}.${rel.fromColumn} -> ${rel.to}.${rel.toColumn}\n` +
      `This foreign key relationship allows JOINing ${rel.from} and ${rel.to} tables\n` +
      `Use for: SELECT queries that need data from both tables`

    docs.push({
      text: relationshipText,
      payload: {
        kind: 'relationship',
        fromTable: rel.from,
        toTable: rel.to,
        fromColumn: rel.fromColumn,
        toColumn: rel.toColumn,
      },
    })
  }

  return docs
}

/* =========================
   Indexing helpers (RAG docs)
   ========================= */
async function indexProject(projectId: string): Promise<{ inserted: number; projectName: string }> {
  const project = await prisma.flowProject.findUnique({
    where: { id: projectId },
    include: { nodes: true, edges: true },
  })
  if (!project) throw new Error(`Project not found with ID: ${projectId}`)

  // Clear existing
  try {
    await (prisma as any).ragDocs.deleteMany({
      where: { payload: { path: ['projectId'], equals: project.id } },
    })
  } catch (err) {
    console.warn('ragDocs deleteMany warning (may be initial run):', err)
  }

  const projectGraphJson = {
    nodes: project.nodes.map((node: any) => ({ type: node.type, data: node.data })),
    edges: project.edges,
  }
  const schemaDocs = extractSchemaInfo(projectGraphJson)
  if (schemaDocs.length === 0) throw new Error('No schema information found to index')

  const processedDocs: Array<{ text: string; payload: string; embedding: string }> = []

  for (const doc of schemaDocs) {
    try {
      const embedding = await getEmbedding(doc.text)
      const payload = {
        ...doc.payload,
        projectId: project.id,
        projectName: project.name,
      }
      processedDocs.push({
        text: doc.text,
        payload: JSON.stringify(payload),
        embedding: JSON.stringify(embedding),
      })
    } catch (err) {
      console.error('Error processing doc for embeddings:', err)
    }
  }

  let inserted = 0
  for (const doc of processedDocs) {
    try {
      await (prisma as any).ragDocs.create({
        data: {
          text: doc.text,
          payload: JSON.parse(doc.payload),
          embedding: doc.embedding,
        },
      })
      inserted++
    } catch (err) {
      console.error('Error inserting ragDoc:', err)
    }
  }

  return { inserted, projectName: project.name }
}

async function getRagFreshness(projectId: string): Promise<Date | null> {
  const latest = await (prisma as any).ragDocs.findFirst({
    where: { payload: { path: ['projectId'], equals: projectId } },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: { updatedAt: true, createdAt: true },
  })
  if (!latest) return null
  return (latest.updatedAt as Date) ?? (latest.createdAt as Date) ?? null
}

/* =========================
   DB Schema sync by projectId (Postgres)
   ========================= */
function qIdent(id: string) {
  return `"${id.replace(/"/g, '""')}"`
}
function mapTypeToPg(t: ColumnNode['type']): string {
  if (t === 'text') return 'TEXT'
  if (t === 'number') return 'NUMERIC'
  if (t === 'boolean') return 'BOOLEAN'
  return 'TEXT'
}

async function constraintExists(conName: string, schemaName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = $1
          AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2)
      ) AS exists;
    `,
    conName,
    schemaName
  )
  return !!rows?.[0]?.exists
}

async function ensureProjectSchema(projectId: string, projectGraphJson: any) {
  // 1) Ensure schema exists
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${qIdent(projectId)};`)

  // 2) For each table node: create/alter structure
  const tableNodes: TableNodeData[] = (projectGraphJson.nodes || [])
    .filter((n: any) => n.type === 'table' && n.data && n.data.table)
    .map((n: any) => n.data)

  for (const t of tableNodes) {
    const schema = qIdent(projectId)
    const table = qIdent(t.table)

    // Create table if missing
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ${schema}.${table} ();`)

    // Existing columns
    const existingCols = (await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string }>>(
      `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `,
      projectId,
      t.table
    )).map((r) => r.column_name)

    // Add missing columns
    for (const col of t.columns || []) {
      if (!existingCols.includes(col.name)) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE ${schema}.${table} ADD COLUMN ${qIdent(col.name)} ${mapTypeToPg(col.type)};`
        )
      }
    }

    // Primary key (single-column)
    const pkCol = (t.columns || []).find((c) => c.isPrimaryKey)
    if (pkCol) {
      const pkConName = `${t.table}_pkey`
      const hasPk = await constraintExists(pkConName, projectId)
      if (!hasPk) {
        const pkName = qIdent(pkConName)
        await prisma.$executeRawUnsafe(
          `ALTER TABLE ${schema}.${table} ADD CONSTRAINT ${pkName} PRIMARY KEY (${qIdent(pkCol.name)});`
        )
      }
    }

    // Foreign keys
    for (const col of t.columns || []) {
      if (col.isForeignKey && col.references?.table) {
        const refTable = qIdent(col.references.table)
        const refCol = qIdent(col.references.column || 'id')
        const fkConName = `${t.table}_${col.name}_fkey`
        const hasFk = await constraintExists(fkConName, projectId)
        if (!hasFk) {
          const fkName = qIdent(fkConName)
          await prisma.$executeRawUnsafe(
            `ALTER TABLE ${schema}.${table}
             ADD CONSTRAINT ${fkName}
             FOREIGN KEY (${qIdent(col.name)})
             REFERENCES ${schema}.${refTable}(${refCol});`
          )
        }
      }
    }

    // 3) Load/refresh data if provided (truncate + insert)
    if (Array.isArray(t.data) && t.data.length > 0) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${schema}.${table} RESTART IDENTITY;`)

      const columns = Array.from(new Set(t.data.flatMap((row) => Object.keys(row))))
      if (columns.length > 0) {
        const colsSql = columns.map(qIdent).join(', ')
        const rows = t.data
        const params: any[] = []
        const valuesSqlParts: string[] = []
        let p = 1
        for (const row of rows) {
          const placeholders: string[] = []
          for (const c of columns) {
            placeholders.push(`$${p++}`)
            params.push(row[c] ?? null)
          }
          valuesSqlParts.push(`(${placeholders.join(', ')})`)
        }
        const insertSql = `INSERT INTO ${schema}.${table} (${colsSql}) VALUES ${valuesSqlParts.join(', ')};`
        await prisma.$executeRawUnsafe(insertSql, ...params)
      }
    }
  }
}

/* =========================
   Freshness gate: if no ragDocs OR older than flowProject.updatedAt → reindex + sync schema
   ========================= */
async function ensureFreshIndexAndSchema(projectId: string) {
  const project = await prisma.flowProject.findUnique({
    where: { id: projectId },
    include: { nodes: true, edges: true },
  })
  if (!project) throw new Error('Project not found')

  const ragFresh = await getRagFreshness(projectId)
  const projectUpdatedAt: Date = (project as any).updatedAt as Date
  const needsReindex = !ragFresh || (projectUpdatedAt && ragFresh < projectUpdatedAt)

  if (needsReindex) {
    await indexProject(projectId)
    const projectGraphJson = {
      nodes: project.nodes.map((n: any) => ({ type: n.type, data: n.data })),
      edges: project.edges,
    }
    await ensureProjectSchema(projectId, projectGraphJson)
  }

  return { reindexed: needsReindex, projectName: project.name }
}

/* =========================
   RAG: similarity search
   ========================= */
async function searchSimilarDocuments(
  queryEmbedding: number[],
  projectId: string,
  limit: number = 5,
  minCosine?: number
) {
  try {
    const allDocs = await (prisma as any).ragDocs.findMany({
      where: {
        payload: { path: ['projectId'], equals: projectId },
        embedding: { not: null },
      },
    })

    const similarities = allDocs.map((doc: any) => {
      const docEmbedding = JSON.parse(doc.embedding || '[]')
      const similarity = cosineSimilarity(queryEmbedding, docEmbedding)
      return { ...doc, similarity }
    })

    const sorted = similarities.sort((a: any, b: any) => b.similarity - a.similarity)
    const filtered = typeof minCosine === 'number' ? sorted.filter((d: any) => d.similarity >= minCosine) : sorted

    return filtered.slice(0, limit).map(({ similarity, embedding, createdAt, updatedAt, ...doc }: any) => ({
      ...doc,
      payload: typeof doc.payload === 'string' ? JSON.parse(doc.payload) : doc.payload,
      similarity,
    }))
  } catch (error) {
    console.error('Error in similarity search:', error)
    throw error
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0,
    na = 0,
    nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/* =========================
   SQL preview (simple)
   ========================= */
type RagDoc = { payload: any; similarity: number }

function pickTopTable(results: RagDoc[]): { table: string | null; columns: string[] } {
  let bestTable: string | null = null
  let bestScore = -Infinity
  const columns: string[] = []

  for (const r of results) {
    if (r.payload?.kind === 'table' && r.payload?.table) {
      if (r.similarity > bestScore) {
        bestScore = r.similarity
        bestTable = r.payload.table
      }
    }
  }
  for (const r of results) {
    if (r.payload?.kind === 'column' && r.payload?.table === bestTable) {
      columns.push(r.payload.column)
    }
  }
  return { table: bestTable, columns: Array.from(new Set(columns)).slice(0, 10) }
}

function findTopRelationship(results: RagDoc[]) {
  return results.find((r) => r.payload?.kind === 'relationship')?.payload as
    | { fromTable: string; toTable: string; fromColumn: string; toColumn: string }
    | undefined
}

async function executePreviewSQL(projectId: string, results: RagDoc[]) {
  const schema = qIdent(projectId)
  const relationship = findTopRelationship(results)
  const { table, columns } = pickTopTable(results)

  if (relationship) {
    const left = qIdent(relationship.fromTable)
    const right = qIdent(relationship.toTable)
    const leftCol = qIdent(relationship.fromColumn)
    const rightCol = qIdent(relationship.toColumn)
    const sql = `
      SELECT *
      FROM ${schema}.${left} AS l
      JOIN ${schema}.${right} AS r
        ON l.${leftCol} = r.${rightCol}
      LIMIT 50;
    `
    try {
      const rows = await prisma.$queryRawUnsafe(sql)
      return { sql, rows }
    } catch (err) {
      console.warn('JOIN preview failed, falling back to single table:', err)
    }
  }

  if (table) {
    const t = qIdent(table)
    const selectCols = columns.length > 0 ? columns.map(qIdent).join(', ') : '*'
    const sql = `SELECT ${selectCols} FROM ${schema}.${t} LIMIT 50;`
    const rows = await prisma.$queryRawUnsafe(sql)
    return { sql, rows }
  }

  return { sql: null, rows: [] }
}

/* =========================
   POST (manual re-index)
   ========================= */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId } = body
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const project = await prisma.flowProject.findUnique({
      where: { id: projectId },
      include: { nodes: true, edges: true },
    })
    if (!project) {
      return NextResponse.json({ error: `Project not found with ID: ${projectId}` }, { status: 404 })
    }

    const { inserted, projectName } = await indexProject(projectId)

    const projectGraphJson = {
      nodes: project.nodes.map((n: any) => ({ type: n.type, data: n.data })),
      edges: project.edges,
    }
    await ensureProjectSchema(projectId, projectGraphJson)

    return NextResponse.json({
      success: true,
      message: `Indexed ${inserted} schema documents and synced schema ${projectId}`,
      projectId,
      projectName,
      documentsIndexed: inserted,
    })
  } catch (error: any) {
    console.error('Index error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/* =========================
   GET (auto re-index if stale) + RAG + SQL preview
   ========================= */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const query = searchParams.get('query')

    const limitRaw = searchParams.get('limit') || '5'
    const limit = Number.isFinite(Number(limitRaw)) ? parseInt(limitRaw, 10) : 5

    // min_cosine (and tolerant alias min_coisine)
    const rawMin = searchParams.get('min_cosine') ?? searchParams.get('min_coisine')
    const minCosine = (() => {
      if (rawMin == null) return undefined
      const v = Number(rawMin)
      if (!Number.isFinite(v)) return undefined
      return Math.max(-1, Math.min(1, v))
    })()

    if (query) {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required for search' }, { status: 400 })
      }

      const freshness = await ensureFreshIndexAndSchema(projectId)

      const queryEmbedding = await getEmbedding(query)
      const results = await searchSimilarDocuments(queryEmbedding, projectId, limit, minCosine)

      let preview: { sql: string | null; rows: any[] } = { sql: null, rows: [] }
      try {
        preview = await executePreviewSQL(projectId, results as RagDoc[]) as any
      } catch (err) {
        console.error('Preview SQL execution error:', err)
      }

      return NextResponse.json({
        query,
        projectId,
        reindexed: freshness.reindexed,
        min_cosine: typeof minCosine === 'number' ? minCosine : null,
        rag: {
          count: results.length,
          results,
        },
        sql_preview: {
          schema: projectId,
          sql: preview.sql,
          rowCount: Array.isArray(preview.rows) ? preview.rows.length : 0,
          rows: preview.rows,
        },
      })
    }

    // No query → just counts (+ freshness)
    let count = 0
    if (projectId && projectId !== 'undefined') {
      count = await (prisma as any).ragDocs.count({
        where: { payload: { path: ['projectId'], equals: projectId } },
      })
    } else {
      count = await (prisma as any).ragDocs.count()
    }

    const freshnessDate = projectId ? await getRagFreshness(projectId) : null

    return NextResponse.json({
      count,
      projectId: projectId || null,
      latestRagUpdatedAt: freshnessDate ? freshnessDate.toISOString() : null,
    })
  } catch (error: any) {
    console.error('GET error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
