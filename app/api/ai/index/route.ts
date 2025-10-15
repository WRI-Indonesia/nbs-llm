import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EMBED_MODEL = process.env.EMBED_MODEL_NAME || 'text-embedding-3-large'

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

// Extract schema information from graph JSON
function extractSchemaInfo(graphJson: any) {
  const docs: Array<{text: string, payload: any}> = []
  
  if (!graphJson?.nodes) return docs
  
  for (const node of graphJson.nodes) {
    if (node.type === 'table' && node.data) {
      const tableData = node.data
      
      // Add table description
      if (tableData.description) {
        docs.push({
          text: `Table: ${tableData.table}\nDescription: ${tableData.description}`,
          payload: {
            kind: 'table',
            table: tableData.table,
            description: tableData.description
          }
        })
      }
      
      // Add column information
      if (tableData.columns && Array.isArray(tableData.columns)) {
        for (const column of tableData.columns) {
          let text = `Column: ${tableData.table}.${column.name} (${column.type})`
          
          if (column.description) {
            text += `\nDescription: ${column.description}`
          }
          
          if (column.isPrimaryKey) {
            text += '\nPrimary Key: Yes'
          }
          
          if (column.isForeignKey) {
            text += '\nForeign Key: Yes'
            if (column.references) {
              text += `\nReferences: ${column.references.table}.${column.references.column || 'id'}`
            }
          }
          
          docs.push({
            text,
            payload: {
              kind: 'column',
              table: tableData.table,
              column: column.name,
              type: column.type,
              description: column.description,
              isPrimaryKey: column.isPrimaryKey || false,
              isForeignKey: column.isForeignKey || false,
              references: column.references || null
            }
          })
        }
      }
    }
  }
  
  return docs
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schemaId, sessionId } = body
    
    if (!schemaId && !sessionId) {
      return NextResponse.json(
        { error: 'Either schemaId or sessionId is required' },
        { status: 400 }
      )
    }
    
    // Find the schema directly from database
    let schema: any = null
    
    if (schemaId) {
      // Get specific schema by ID
      try {
        schema = await prisma.schema.findUnique({
          where: { id: schemaId }
        })
      } catch (error) {
        console.error('Error fetching schema by ID:', error)
      }
    }
    
    if (!schema && sessionId) {
      // Get schema by session ID
      try {
        const schemas = await prisma.schema.findMany({
          where: { sessionId: sessionId }
        })
        schema = schemas.find((s: any) => s.name.startsWith('playground-'))
      } catch (error) {
        console.error('Error fetching schema by session ID:', error)
      }
    }
    
    if (!schema) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      )
    }
    
    // Clear existing RAG docs for this schema
    try {
      await prisma.ragDoc.deleteMany({
        where: {
          payload: {
            path: ['schemaId'],
            equals: schema.id
          }
        }
      })
    } catch (error) {
      console.error('Error clearing existing RAG docs:', error)
      // Continue anyway, might be first time indexing
    }
    
    // Extract schema information
    const schemaDocs = extractSchemaInfo(schema.graphJson)
    
    if (schemaDocs.length === 0) {
      return NextResponse.json(
        { error: 'No schema information found to index' },
        { status: 400 }
      )
    }
    
    // Process each document
    const processedDocs = []
    
    for (const doc of schemaDocs) {
      try {
        // Get embedding
        const embedding = await getEmbedding(doc.text)
        
        // Add schema ID to payload
        const payload = {
          ...doc.payload,
          schemaId: schema.id,
          schemaName: schema.name
        }
        
        processedDocs.push({
          text: doc.text,
          payload: JSON.stringify(payload),
          embedding: JSON.stringify(embedding)
        })
      } catch (error) {
        console.error('Error processing doc:', error)
        // Continue with other docs
      }
    }
    
    // Insert into database
    let insertedCount = 0
    
    for (const doc of processedDocs) {
      try {
        await prisma.ragDoc.create({
          data: {
            text: doc.text,
            payload: JSON.parse(doc.payload),
            embedding: doc.embedding
          }
        })
        insertedCount++
      } catch (error) {
        console.error('Error inserting doc:', error)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Indexed ${insertedCount} schema documents`,
      schemaId: schema.id,
      schemaName: schema.name,
      documentsIndexed: insertedCount
    })
    
  } catch (error: any) {
    console.error('Index error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schemaId = searchParams.get('schemaId')
    
    let count = 0
    
    if (schemaId) {
      count = await prisma.ragDoc.count({
        where: {
          payload: {
            path: ['schemaId'],
            equals: schemaId
          }
        }
      })
    } else {
      count = await prisma.ragDoc.count()
    }
    
    return NextResponse.json({
      count,
      schemaId: schemaId || null
    })
    
  } catch (error: any) {
    console.error('Get index status error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
