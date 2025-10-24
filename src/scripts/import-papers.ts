/**
 * Bulk Paper Import Script
 * Imports all papers from MinIO into PostgreSQL vector database
 * 
 * Usage: npx tsx src/scripts/import-papers.ts
 */

import { PrismaClient } from '@prisma/client'
import { listPapers, downloadPaper } from '../lib/minio-client'
import { processPaper } from '../lib/pdf-processor'

const prisma = new PrismaClient()

interface ImportOptions {
  bucket?: string
  prefix?: string
  limit?: number
  skipExisting?: boolean
  projectId?: string
}

/**
 * Extract paper metadata from filename
 * Example: "Smith_2020_ClimateChange.pdf" → { authors: "Smith", year: 2020, title: "Climate Change" }
 */
function extractMetadataFromFilename(fileName: string): {
  title: string
  authors?: string
  year?: number
} {
  // Remove .pdf extension
  const nameWithoutExt = fileName.replace(/\.pdf$/i, '')

  // Try to parse pattern: Author_Year_Title
  const parts = nameWithoutExt.split('_')

  if (parts.length >= 3) {
    const potentialYear = parseInt(parts[1])
    if (!isNaN(potentialYear) && potentialYear > 1900 && potentialYear < 2100) {
      return {
        authors: parts[0].replace(/-/g, ' '),
        year: potentialYear,
        title: parts.slice(2).join(' ').replace(/-/g, ' '),
      }
    }
  }

  // Fallback: use full filename as title
  return {
    title: nameWithoutExt.replace(/-|_/g, ' '),
  }
}

/**
 * Check if paper already exists in database
 */
async function paperAlreadyImported(fileName: string, nodeId: string): Promise<boolean> {
  // Query all papers for this node and check fileName in payload manually
  const papers = await (prisma.ragDocs.findMany as any)({
    where: {
      nodeId,
      source: 'paper',
    },
  })

  // Check if any paper has this fileName in its payload
  return papers.some((paper: any) => {
    const payload = paper.payload as any
    return payload?.fileName === fileName
  })
}

/**
 * Import a single paper into the database
 */
async function importPaper(
  paperPath: string,
  fileName: string,
  nodeId: string,
  bucket: string = 'etl-kms'
): Promise<{ success: boolean; chunks: number; error?: string }> {
  console.log(`\n📖 Processing: ${fileName}`)

  try {
    // Download PDF from MinIO
    const pdfBuffer = await downloadPaper(paperPath, bucket)

    // Process PDF: extract text, chunk, embed
    const { chunks, embeddings, metadata } = await processPaper(pdfBuffer, {
      maxTokensPerChunk: 800,
      minTokensPerChunk: 100,
      overlapTokens: 100,
    })

    // Extract metadata from filename
    const paperMetadata = extractMetadataFromFilename(fileName)

    // Store chunks in database
    let storedChunks = 0
    for (const { chunk, embedding } of embeddings) {
      await (prisma.ragDocs.create as any)({
        data: {
          nodeId,
          text: chunk.text,
          embedding: JSON.stringify(embedding),
          source: 'paper',
          payload: {
            fileName,
            path: paperPath,
            bucket,
            title: paperMetadata.title,
            authors: paperMetadata.authors,
            year: paperMetadata.year,
            chunkIndex: chunk.chunkIndex,
            section: chunk.section,
            tokenCount: chunk.tokenCount,
            totalPages: metadata.pages,
            processedAt: metadata.extractedAt.toISOString(),
          },
        },
      })
      storedChunks++
    }

    console.log(`✅ Imported ${storedChunks} chunks from ${fileName}`)
    return { success: true, chunks: storedChunks }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`❌ Failed to import ${fileName}:`, errorMsg)
    return { success: false, chunks: 0, error: errorMsg }
  }
}

/**
 * Main import function
 */
export async function importPapersFromMinio(options: ImportOptions = {}): Promise<void> {
  const bucket = options.bucket || 'etl-kms'
  const prefix = options.prefix || 'open_alex/gold_papers/'
  const limit = options.limit
  const skipExisting = options.skipExisting ?? true

  console.log('🚀 Starting paper import from MinIO...')
  console.log(`📍 Source: ${bucket}/${prefix}`)
  console.log(`📊 Limit: ${limit || 'No limit'}`)
  console.log(`⏭️  Skip existing: ${skipExisting}`)

  try {
    // Get or create a default project/node for papers
    let project = await prisma.flowProject.findFirst({
      where: { name: 'Knowledge Base Papers' },
    })

    if (!project) {
      project = await prisma.flowProject.create({
        data: {
          name: 'Knowledge Base Papers',
          description: 'Imported peer-reviewed journals from MinIO',
        },
      })
      console.log(`✅ Created project: ${project.id}`)
    }

    // Get or create a node for this import batch
    const nodeId = options.projectId || `paper-node-${Date.now()}`
    let node = await prisma.flowNode.findFirst({
      where: { projectId: project.id, nodeId },
    })

    if (!node) {
      node = await prisma.flowNode.create({
        data: {
          projectId: project.id,
          nodeId,
          type: 'papers',
          position: { x: 0, y: 0 },
          data: { label: 'Research Papers', source: 'minio' },
        },
      })
      console.log(`✅ Created node: ${node.id}`)
    }

    // List all papers from MinIO
    const papers = await listPapers(bucket, prefix)
    const papersToProcess = limit ? papers.slice(0, limit) : papers

    console.log(`\n📚 Found ${papers.length} papers, processing ${papersToProcess.length}`)

    // Import statistics
    const stats = {
      total: papersToProcess.length,
      success: 0,
      skipped: 0,
      failed: 0,
      totalChunks: 0,
    }

    // Process each paper
    for (let i = 0; i < papersToProcess.length; i++) {
      const paper = papersToProcess[i]
      console.log(`\n[${i + 1}/${papersToProcess.length}] Processing: ${paper.fileName}`)

      // Skip if already imported
      if (skipExisting) {
        const exists = await paperAlreadyImported(paper.fileName, node.id)
        if (exists) {
          console.log(`⏭️  Skipping (already imported): ${paper.fileName}`)
          stats.skipped++
          continue
        }
      }

      // Import paper
      const result = await importPaper(paper.path, paper.fileName, node.id, bucket)

      if (result.success) {
        stats.success++
        stats.totalChunks += result.chunks
      } else {
        stats.failed++
      }

      // Rate limiting: wait between papers
      if (i < papersToProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Import Summary')
    console.log('='.repeat(60))
    console.log(`Total papers: ${stats.total}`)
    console.log(`✅ Successfully imported: ${stats.success}`)
    console.log(`⏭️  Skipped: ${stats.skipped}`)
    console.log(`❌ Failed: ${stats.failed}`)
    console.log(`📝 Total chunks created: ${stats.totalChunks}`)
    console.log('='.repeat(60))
  } catch (error) {
    console.error('Fatal error during import:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  const limit = process.env.IMPORT_LIMIT ? parseInt(process.env.IMPORT_LIMIT) : undefined

  importPapersFromMinio({ limit })
    .then(() => {
      console.log('✅ Import completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Import failed:', error)
      process.exit(1)
    })
}

