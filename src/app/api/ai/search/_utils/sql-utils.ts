import { PrismaClient } from '@prisma/client'

/**
 * Cleans SQL query from markdown formatting
 */
function cleanSQLQuery(sqlQuery: string): string {
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
 * Creates a Prisma client with a specific schema
 */
function createPrismaClientWithSchema(schemaName: string): PrismaClient {
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
 * Executes SQL query using project schema
 */
export async function executeSQLQuery(
  sqlQuery: string,
  projectId: string,
): Promise<any[]> {
  const prismaForSchema = createPrismaClientWithSchema(projectId)

  try {
    // Clean the SQL query first (this removes schema prefixes)
    const cleanedQuery = cleanSQLQuery(sqlQuery)

    // Execute against the project's schema
    const result = await prismaForSchema.$queryRawUnsafe(cleanedQuery)

    return result as any[]
  } catch (error) {
    console.error('Error executing SQL query:', error)
    throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    // In serverless environments it's fine to disconnect after each request.
    await prismaForSchema.$disconnect().catch(() => { })
  }
}
