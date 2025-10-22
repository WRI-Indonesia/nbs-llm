import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import type { TableNodeData, Column } from '@/types/table-nodes'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Function to validate references exist in the project
async function validateReferences(nodeId: string, columns: Column[]): Promise<Column[]> {
  // Get the flow node to access projectId
  const flowNode = await prisma.flowNode.findUnique({
    where: { id: nodeId },
    include: {
      project: {
        include: {
          nodes: true
        }
      }
    }
  })

  if (!flowNode) {
    throw new Error('Flow node not found')
  }

  // Get all table names in the project
  const projectTableNames = new Set<string>()
  for (const node of flowNode.project.nodes) {
    if (node.type === 'table' && node.data) {
      const nodeData = node.data as unknown as TableNodeData
      if (nodeData.table) {
        projectTableNames.add(nodeData.table)
      }
    }
  }

  // Validate references and filter out invalid ones
  const validatedColumns = columns.map(column => {
    if (column.references && column.references.table) {
      // Check if the referenced table exists in the project
      if (!projectTableNames.has(column.references.table)) {
        console.warn(`Reference to table '${column.references.table}' not found in project, removing reference from column '${column.name}'`)
        return {
          ...column,
          references: undefined
        }
      }
    }
    return column
  })

  return validatedColumns
}

// Function to generate text content for table-level RAG document
function generateTableRagText(tableData: TableNodeData): string {
  let text = `Table: ${tableData.table}`
  
  if (tableData.description) {
    text += `; Description: ${tableData.description}`
  }
  
  if (tableData.schema) {
    text += `; Schema: ${tableData.schema}`
  }
  
  return text.trim()
}

// Function to generate text content for a single column RAG document
function generateColumnRagText(tableData: TableNodeData, column: Column): string {
  let text = `Table: ${tableData.table}; Column: ${column.name}; Type: ${column.type}`
  
  if (column.description) {
    text += `; Description: ${column.description}`
  }
  
  if (column.isPrimaryKey) {
    text += `; Primary Key: Yes`
  }
  
  if (column.isForeignKey) {
    text += `; Foreign Key: Yes`
  }
  
  if (column.references) {
    text += `; References: ${column.references.table}`
    if (column.references.column) {
      text += `.${column.references.column}`
    }
  }
  
  return text.trim()
}

// Function to generate embedding using OpenAI
async function generateEmbedding(text: string): Promise<string | null> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: text,
    })
    
    return JSON.stringify(response.data[0].embedding)
  } catch (error) {
    console.error('Error generating embedding:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Fetch the flow project with all nodes
    const project = await prisma.flowProject.findUnique({
      where: { id: projectId },
      include: {
        nodes: true
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete all existing RAG documents for this project
    const nodeIds = project.nodes.map((node: any) => node.id)
    await prisma.ragDocs.deleteMany({
      where: { 
        nodeId: { in: nodeIds }
      }
    })

    // Generate RAG documents for all table nodes and their columns in the project
    const tableNodes = project.nodes.filter((node: any) => node.type === 'table')
    const generatedRagDocs = []

    for (const node of tableNodes) {
      try {
        // Parse the table data
        const tableData = node.data as unknown as TableNodeData
        
        if (!tableData.table || !tableData.columns) {
          console.warn(`Skipping node ${node.id}: Invalid table data`)
          continue
        }

        // Validate references and filter out invalid ones
        const validatedColumns = await validateReferences(node.id, tableData.columns)

        // 1. Create a table-level RAG document
        try {
          const tableText = generateTableRagText(tableData)
          const tableEmbedding = await generateEmbedding(tableText)

          const tableRagDoc = await prisma.ragDocs.create({
            data: {
              nodeId: node.id,
              text: tableText,
              embedding: tableEmbedding
            } as any
          })

          generatedRagDocs.push({
            id: tableRagDoc.id,
            nodeId: tableRagDoc.nodeId,
            tableName: tableData.table,
            columnName: null, // Table-level document
            documentType: 'table',
            text: tableRagDoc.text,
            hasEmbedding: !!tableRagDoc.embedding,
            createdAt: tableRagDoc.createdAt,
            updatedAt: tableRagDoc.updatedAt
          })

        } catch (tableError) {
          console.error(`Error processing table ${tableData.table} in node ${node.id}:`, tableError)
        }

        // 2. Create separate RAG documents for each column
        for (const column of validatedColumns) {
          try {
            // Generate the text content for this specific column
            const text = generateColumnRagText(tableData, column)

            // Generate embedding
            const embedding = await generateEmbedding(text)

            // Create new RAG document for this column
            const ragDoc = await prisma.ragDocs.create({
              data: {
                nodeId: node.id,
                text,
                embedding
              } as any
            })

            generatedRagDocs.push({
              id: ragDoc.id,
              nodeId: ragDoc.nodeId,
              tableName: tableData.table,
              columnName: column.name,
              documentType: 'column',
              text: ragDoc.text,
              hasEmbedding: !!ragDoc.embedding,
              createdAt: ragDoc.createdAt,
              updatedAt: ragDoc.updatedAt
            })

          } catch (columnError) {
            console.error(`Error processing column ${column.name} in node ${node.id}:`, columnError)
            // Continue with other columns even if one fails
          }
        }

      } catch (error) {
        console.error(`Error processing node ${node.id}:`, error)
        // Continue with other nodes even if one fails
      }
    }

    // Calculate statistics
    const tableDocs = generatedRagDocs.filter(doc => doc.documentType === 'table')
    const columnDocs = generatedRagDocs.filter(doc => doc.documentType === 'column')
    const totalColumns = columnDocs.length

    return NextResponse.json({
      success: true,
      projectId,
      totalNodes: tableNodes.length,
      totalTables: tableDocs.length,
      totalColumns: totalColumns,
      totalDocuments: generatedRagDocs.length,
      ragDocs: generatedRagDocs
    })

  } catch (error) {
    console.error('Error generating RAG documents:', error)
    return NextResponse.json({ 
      error: 'Failed to generate RAG documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
