import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import type { TableNodeData, Column } from '@/types/table-nodes'
import { generateQueryEmbedding } from '../search/_utils/generate-embedding-agent'

/* ===================== Helpers ===================== */

// Validate referenced tables exist inside the same project
async function validateReferences(nodeId: string, columns: Column[]): Promise<Column[]> {
  const flowNode = await prisma.flowNode.findUnique({
    where: { id: nodeId },
    include: { project: { include: { nodes: true } } }
  })
  if (!flowNode) throw new Error('Flow node not found')

  const projectTableNames = new Set<string>()
  for (const node of flowNode.project.nodes) {
    if (node.type === 'table' && node.data) {
      const nodeData = node.data as unknown as TableNodeData
      if (nodeData.table) projectTableNames.add(nodeData.table)
    }
  }

  return columns.map(column => {
    if (column.references?.table && !projectTableNames.has(column.references.table)) {
      console.warn(
        `Reference to table '${column.references.table}' not found in project, removing reference from column '${column.name}'`
      )
      return { ...column, references: undefined }
    }
    return column
  })
}

// Build text for table-level RAG doc
function generateTableRagText(tableData: TableNodeData): string {
  let text = `Table: ${tableData.table}`
  if (tableData.description) text += `; Description: ${tableData.description}`
  if (tableData.schema) text += `; Schema: ${tableData.schema}`
  return text.trim()
}

// Build text for column-level RAG doc
function generateColumnRagText(tableData: TableNodeData, column: Column): string {
  let text = `Table: ${tableData.table}; Column: ${column.name}; Type: ${column.type}`
  if (column.description) text += `; Description: ${column.description}`
  if (column.isPrimaryKey) text += `; Primary Key: Yes`
  if (column.isForeignKey) text += `; Foreign Key: Yes`
  if (column.references) {
    text += `; References: ${column.references.table}`
    if (column.references.column) text += `.${column.references.column}`
  }
  return text.trim()
}

// One-step insert (with RETURNING). If embedding is null, insert without it.
async function insertNodeDocRaw(
  nodeId: string,
  text: string,
  embeddingStr: string | null
): Promise<{ id: number; nodeId: string; text: string; createdAt: Date; updatedAt: Date }> {
  if (embeddingStr) {
    const rows = await prisma.$queryRawUnsafe<
      { id: number; nodeId: string; text: string; createdAt: Date; updatedAt: Date }[]
    >(
      `
      INSERT INTO "node_docs" ("nodeId", "text", "embedding")
      VALUES ($1, $2, ($3)::vector(3072))
      RETURNING id, "nodeId", "text", "createdAt", "updatedAt"
      `,
      nodeId,
      text,
      embeddingStr
    )
    return rows[0]
  }

  // No embedding → normal Prisma insert (embedding stays NULL)
  return prisma.nodeDocs.create({
    data: { nodeId, text },
    select: { id: true, nodeId: true, text: true, createdAt: true, updatedAt: true }
  })
}

/* ===================== Route ===================== */

export async function GET(request: NextRequest) {
  try {
    // Admin check
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Fetch project and nodes
    const project = await prisma.flowProject.findUnique({
      where: { id: projectId },
      include: { nodes: true }
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete existing NodeDocs for this project's nodes (then recreate)
    const nodeIds = project.nodes.map(n => n.id)
    await prisma.nodeDocs.deleteMany({ where: { nodeId: { in: nodeIds } } })

    // Generate new RAG docs for table nodes
    const tableNodes = project.nodes.filter((node: any) => node.type === 'table')
    const generatedRagDocs: Array<{
      id: number
      nodeId: string
      tableName: string
      columnName: string | null
      documentType: 'table' | 'column'
      text: string
      hasEmbedding: boolean
      createdAt: Date
      updatedAt: Date
    }> = []

    for (const node of tableNodes) {
      try {
        const tableData = node.data as unknown as TableNodeData
        if (!tableData?.table || !tableData?.columns) {
          console.warn(`Skipping node ${node.id}: Invalid table data`)
          continue
        }

        const validatedColumns = await validateReferences(node.id, tableData.columns)

        // 1) Table-level doc
        try {
          const tableText = generateTableRagText(tableData)
          const tableEmbedding = await generateQueryEmbedding(tableText)

          const tableRagDoc = await insertNodeDocRaw(node.id, tableText, JSON.stringify(tableEmbedding))

          generatedRagDocs.push({
            id: tableRagDoc.id,
            nodeId: tableRagDoc.nodeId,
            tableName: tableData.table,
            columnName: null,
            documentType: 'table',
            text: tableRagDoc.text,
            hasEmbedding: !!tableEmbedding,
            createdAt: tableRagDoc.createdAt,
            updatedAt: tableRagDoc.updatedAt
          })
        } catch (tableError) {
          console.error(`Error processing table ${tableData.table} in node ${node.id}:`, tableError)
        }

        // 2) Column-level docs
        for (const column of validatedColumns) {
          try {
            const text = generateColumnRagText(tableData, column)
            const embedding = await generateQueryEmbedding(text)

            const ragDoc = await insertNodeDocRaw(node.id, text, JSON.stringify(embedding))

            generatedRagDocs.push({
              id: ragDoc.id,
              nodeId: ragDoc.nodeId,
              tableName: tableData.table,
              columnName: column.name,
              documentType: 'column',
              text: ragDoc.text,
              hasEmbedding: !!embedding,
              createdAt: ragDoc.createdAt,
              updatedAt: ragDoc.updatedAt
            })
          } catch (columnError) {
            console.error(`Error processing column ${column.name} in node ${node.id}:`, columnError)
          }
        }
      } catch (e) {
        console.error(`Error processing node ${node.id}:`, e)
      }
    }

    // Stats
    const tableDocs = generatedRagDocs.filter(d => d.documentType === 'table')
    const columnDocs = generatedRagDocs.filter(d => d.documentType === 'column')

    return NextResponse.json({
      success: true,
      projectId,
      totalNodes: tableNodes.length,
      totalTables: tableDocs.length,
      totalColumns: columnDocs.length,
      totalDocuments: generatedRagDocs.length,
      ragDocs: generatedRagDocs
    })
  } catch (error) {
    console.error('Error generating RAG documents:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate RAG documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
