import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'
import type { TableNodeData, Column } from '@/types/table-nodes'
import OpenAI from 'openai'

interface TableDefinition {
  name: string
  schema: string
  description?: string
  columns: Column[]
  data?: any[]
}

interface Relationship {
  sourceTable: string
  targetTable: string
  sourceColumn: string
  targetColumn: string
}

// Function to use OpenAI for schema generation
async function generateSchemaWithOpenAI(tableDefinitions: TableDefinition[], relationships: Relationship[]): Promise<string[]> {
  try {
    const prompt = `
You are a database schema expert. Based on the following table definitions and relationships, generate optimized PostgreSQL DDL statements.

Table Definitions:
${JSON.stringify(tableDefinitions, null, 2)}

Relationships:
${JSON.stringify(relationships, null, 2)}

Please generate PostgreSQL DDL statements that:
1. Drop the existing schema if it exists (using CASCADE to remove all contents)
2. Create a new schema named after the project
3. Create tables with appropriate data types, constraints, and indexes
4. Add foreign key relationships
5. Include proper comments
6. Optimize for performance and data integrity

Return only the SQL statements, one per line, without explanations.
`;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a PostgreSQL database expert. Generate optimized DDL statements based on table definitions and relationships."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })

    const sqlContent = completion.choices[0]?.message?.content || ''
    return sqlContent.split('\n').filter(line => line.trim() && (
      line.trim().startsWith('DROP') || 
      line.trim().startsWith('CREATE') || 
      line.trim().startsWith('ALTER') || 
      line.trim().startsWith('COMMENT')
    ))
  } catch (error) {
    console.error('OpenAI schema generation failed:', error)
    return []
  }
}

// Function to generate schema manually
function generateManualSchema(schemaName: string, tableDefinitions: TableDefinition[], relationships: Relationship[]): string[] {
  const sqlStatements: string[] = []
  
  // Drop existing schema and all its contents (CASCADE will drop all tables, views, constraints, etc.)
  sqlStatements.push(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`)
  
  // Create new schema
  sqlStatements.push(`CREATE SCHEMA "${schemaName}";`)

  // Create tables
  for (const table of tableDefinitions) {
    const sanitizedTableName = table.name.replace(/[^a-zA-Z0-9_]/g, '_')
    let createTableSQL = `CREATE TABLE "${schemaName}"."${sanitizedTableName}" (\n`
    
    const columnDefinitions: string[] = []
    
    for (const column of table.columns) {
      const sanitizedColumnName = column.name.replace(/[^a-zA-Z0-9_]/g, '_')
      let columnDef = `  "${sanitizedColumnName}" `
      
      // Map column types to PostgreSQL types
      switch (column.type) {
        case 'text':
          columnDef += 'TEXT'
          break
        case 'number':
          columnDef += 'NUMERIC'
          break
        case 'boolean':
          columnDef += 'BOOLEAN'
          break
        default:
          columnDef += 'TEXT'
      }
      
      // Add NOT NULL constraint for required fields
      if (column.isPrimaryKey || column.isForeignKey) {
        columnDef += ' NOT NULL'
      }
      
      // Add primary key constraint (separate from column definition for better SQL)
      if (column.isPrimaryKey) {
        columnDef += ' PRIMARY KEY'
      }
      
      columnDefinitions.push(columnDef)
    }
    
    createTableSQL += columnDefinitions.join(',\n')
    createTableSQL += '\n);'
    
    sqlStatements.push(createTableSQL)
    
    // Add table comment if description exists
    if (table.description) {
      sqlStatements.push(`COMMENT ON TABLE "${schemaName}"."${sanitizedTableName}" IS '${table.description.replace(/'/g, "''")}';`)
    }
    
    // Add column comments
    for (const column of table.columns) {
      if (column.description) {
        const sanitizedColumnName = column.name.replace(/[^a-zA-Z0-9_]/g, '_')
        sqlStatements.push(`COMMENT ON COLUMN "${schemaName}"."${sanitizedTableName}"."${sanitizedColumnName}" IS '${column.description.replace(/'/g, "''")}';`)
      }
    }
  }

  // Create foreign key constraints
  for (const rel of relationships) {
    const sanitizedSourceTable = rel.sourceTable.replace(/[^a-zA-Z0-9_]/g, '_')
    const sanitizedTargetTable = rel.targetTable.replace(/[^a-zA-Z0-9_]/g, '_')
    const sanitizedSourceColumn = rel.sourceColumn.replace(/[^a-zA-Z0-9_]/g, '_')
    const sanitizedTargetColumn = rel.targetColumn.replace(/[^a-zA-Z0-9_]/g, '_')
    
    const fkName = `fk_${sanitizedSourceTable}_${sanitizedSourceColumn}_${sanitizedTargetTable}_${sanitizedTargetColumn}`
    
    sqlStatements.push(`
      ALTER TABLE "${schemaName}"."${sanitizedSourceTable}" 
      ADD CONSTRAINT "${fkName}" 
      FOREIGN KEY ("${sanitizedSourceColumn}") 
      REFERENCES "${schemaName}"."${sanitizedTargetTable}" ("${sanitizedTargetColumn}")
      ON DELETE CASCADE ON UPDATE CASCADE;
    `.trim())
  }

  return sqlStatements
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { projectId, useOpenAI = false, includeData = true } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Fetch the flow project with nodes
    const project = await prisma.flowProject.findUnique({
      where: { id: projectId },
      include: {
        nodes: true,
        edges: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse table definitions from flow nodes
    const tableDefinitions: TableDefinition[] = []
    const relationships: Relationship[] = []

    // Extract table definitions from nodes
    for (const node of project.nodes) {
      if (node.type === 'table' && node.data) {
        const nodeData = node.data as unknown as TableNodeData
        
        if (nodeData.table && nodeData.columns) {
          tableDefinitions.push({
            name: nodeData.table,
            schema: nodeData.schema || projectId, // Use projectId as schema name
            description: nodeData.description,
            columns: nodeData.columns,
            data: nodeData.data || []
          })
        }
      }
    }

    if (tableDefinitions.length === 0) {
      return NextResponse.json({ error: 'No table definitions found in project' }, { status: 400 })
    }

    // Analyze relationships from FlowNode metadata (isPrimaryKey, isForeignKey, references)
    for (const node of project.nodes) {
      if (node.type === 'table' && node.data) {
        const nodeData = node.data as unknown as TableNodeData
        
        if (nodeData.table && nodeData.columns) {
          // Find foreign key columns in this table
          const fkColumns = nodeData.columns.filter(col => col.isForeignKey && col.references)
          
          for (const fkCol of fkColumns) {
            
            if (fkCol.references?.table) {
              // Find the referenced table in our table definitions
              const referencedTable = tableDefinitions.find(t => t.name === fkCol.references?.table)
              
              if (referencedTable) {
                // Find the primary key column in the referenced table
                const pkColumn = referencedTable.columns.find(col => col.isPrimaryKey)
                
                if (pkColumn) {
                  const relationship = {
                    sourceTable: nodeData.table,
                    targetTable: fkCol.references.table,
                    sourceColumn: fkCol.name,
                    targetColumn: pkColumn.name
                  }
                  relationships.push(relationship)
                }
              }
            }
          }
        }
      }
    }
    

    // Generate SQL schema
    const schemaName = projectId.replace(/[^a-zA-Z0-9_]/g, '_') // Sanitize schema name
    let sqlStatements: string[] = []
    
    if (useOpenAI) {
      // Use OpenAI to generate optimized schema
      const openAISqlStatements = await generateSchemaWithOpenAI(tableDefinitions, relationships)
      if (openAISqlStatements.length > 0) {
        sqlStatements = openAISqlStatements
      } else {
        sqlStatements = generateManualSchema(schemaName, tableDefinitions, relationships)
      }
    } else {
      // Generate schema manually
      sqlStatements = generateManualSchema(schemaName, tableDefinitions, relationships)
    }

    // Execute schema creation
    const executionErrors: string[] = []
    for (const sql of sqlStatements) {
      try {
        await prisma.$executeRawUnsafe(sql)
      } catch (error) {
        const errorMessage = `Error executing SQL: ${sql} - ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMessage)
        executionErrors.push(errorMessage)
        // Continue with other statements even if one fails
      }
    }

    // If there were execution errors, return them
    if (executionErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Schema execution failed',
        details: executionErrors,
        success: false
      }, { status: 500 })
    }

    // Insert existing data from FlowNodes if requested
    const insertedData: Record<string, any[]> = {}
    
    if (includeData) {
      // Sort tables to insert parent tables first (tables without foreign keys)
      const sortedTables = [...tableDefinitions].sort((a, b) => {
        const aHasFk = a.columns.some(col => col.isForeignKey)
        const bHasFk = b.columns.some(col => col.isForeignKey)
        if (aHasFk && !bHasFk) return 1 // a has FK, b doesn't -> b first
        if (!aHasFk && bHasFk) return -1 // a doesn't have FK, b does -> a first
        return 0 // both have or don't have FK
      })
      
      for (const table of sortedTables) {
        if (table.data && table.data.length > 0) {
          const sanitizedTableName = table.name.replace(/[^a-zA-Z0-9_]/g, '_')
          
          try {
            // Prepare data for insertion - use the actual data from FlowNode
            const insertData = table.data.map(row => {
              const sanitizedRow: Record<string, any> = {}
              for (const [key, value] of Object.entries(row)) {
                const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '_')
                // Handle empty strings and convert them to NULL for better data integrity
                if (value === '' || value === null || value === undefined) {
                  sanitizedRow[sanitizedKey] = null
                } else {
                  sanitizedRow[sanitizedKey] = value
                }
              }
              return sanitizedRow
            })

            // Build dynamic insert query
            if (insertData.length > 0) {
              const columns = Object.keys(insertData[0])
              const values = insertData.map(row => 
                `(${columns.map(col => {
                  const value = row[col]
                  if (value === null || value === undefined) return 'NULL'
                  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
                  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
                  return value
                }).join(', ')})`
              ).join(', ')

              const insertSQL = `
                INSERT INTO "${schemaName}"."${sanitizedTableName}" (${columns.map(col => `"${col}"`).join(', ')})
                VALUES ${values}
                ON CONFLICT DO NOTHING;
              `.trim()

              await prisma.$executeRawUnsafe(insertSQL)
              insertedData[table.name] = insertData
            }
          } catch (error) {
            console.error(`Error inserting data into ${table.name}:`, error)
            // Continue with other tables even if one fails
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Schema '${schemaName}' created successfully`,
      schemaName,
      tablesCreated: tableDefinitions.length,
      relationshipsCreated: relationships.length,
      sqlStatements: sqlStatements.length,
      insertedData: includeData ? insertedData : null,
      summary: {
        tables: tableDefinitions.map(t => ({
          name: t.name,
          columns: t.columns.length,
          dataRows: t.data?.length || 0
        })),
        relationships: relationships.map(r => ({
          from: `${r.sourceTable}.${r.sourceColumn}`,
          to: `${r.targetTable}.${r.targetColumn}`
        })),
        schemaGenerationMethod: useOpenAI ? 'OpenAI' : 'Manual',
        totalDataInserted: Object.values(insertedData).reduce((sum, data) => sum + data.length, 0)
      }
    })

  } catch (error) {
    console.error('Error creating schema from project:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to retrieve schema information
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

    // Fetch the flow project with nodes
    const project = await prisma.flowProject.findUnique({
      where: { id: projectId },
      include: {
        nodes: true,
        edges: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Analyze the project structure
    const tableDefinitions: TableDefinition[] = []
    const relationships: Relationship[] = []

    // Extract table definitions from nodes
    for (const node of project.nodes) {
      if (node.type === 'table' && node.data) {
        const nodeData = node.data as unknown as TableNodeData
        
        if (nodeData.table && nodeData.columns) {
          tableDefinitions.push({
            name: nodeData.table,
            schema: nodeData.schema || projectId,
            description: nodeData.description,
            columns: nodeData.columns,
            data: nodeData.data || []
          })
        }
      }
    }

    // Analyze relationships from FlowNode metadata (isPrimaryKey, isForeignKey, references)
    for (const node of project.nodes) {
      if (node.type === 'table' && node.data) {
        const nodeData = node.data as unknown as TableNodeData
        
        if (nodeData.table && nodeData.columns) {
          // Find foreign key columns in this table
          const fkColumns = nodeData.columns.filter(col => col.isForeignKey && col.references)
          
          for (const fkCol of fkColumns) {
            if (fkCol.references?.table) {
              // Find the referenced table in our table definitions
              const referencedTable = tableDefinitions.find(t => t.name === fkCol.references?.table)
              
              if (referencedTable) {
                // Find the primary key column in the referenced table
                const pkColumn = referencedTable.columns.find(col => col.isPrimaryKey)
                
                if (pkColumn) {
                  relationships.push({
                    sourceTable: nodeData.table,
                    targetTable: fkCol.references.table,
                    sourceColumn: fkCol.name,
                    targetColumn: pkColumn.name
                  })
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      schemaAnalysis: {
        tables: tableDefinitions.map(t => ({
          name: t.name,
          schema: t.schema,
          description: t.description,
          columns: t.columns.map(c => ({
            name: c.name,
            type: c.type,
            description: c.description,
            isPrimaryKey: c.isPrimaryKey,
            isForeignKey: c.isForeignKey,
            references: c.references
          })),
          dataRows: t.data?.length || 0
        })),
        relationships: relationships.map(r => ({
          from: `${r.sourceTable}.${r.sourceColumn}`,
          to: `${r.targetTable}.${r.targetColumn}`
        })),
        totalTables: tableDefinitions.length,
        totalRelationships: relationships.length
      }
    })

  } catch (error) {
    console.error('Error analyzing project schema:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
