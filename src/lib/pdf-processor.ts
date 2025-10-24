/**
 * PDF Processing Utilities
 * Extracts text, chunks, and generates embeddings from research papers
 */

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface PaperChunk {
  text: string
  chunkIndex: number
  pageNumber?: number
  section?: string
  tokenCount: number
}

export interface ProcessedPaper {
  fullText: string
  chunks: PaperChunk[]
  metadata: {
    pages: number
    extractedAt: Date
    totalTokens: number
  }
}

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Use require for CommonJS module - pdf-parse v2.x
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = require('pdf-parse')
    const parser = new PDFParse({data: pdfBuffer})
    const data = await parser.getText()
    const textContent = data.text || ''
    console.log(`📄 Extracted ${textContent.length} characters`)
    return textContent
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    throw new Error('Failed to extract text from PDF')
  }
}

/**
 * Detect section headers (Introduction, Methods, Results, Discussion, etc.)
 */
function detectSection(text: string): string | undefined {
  const lowerText = text.toLowerCase().trim()
  
  // Common section patterns in academic papers
  const sections = [
    { pattern: /^abstract/i, name: 'Abstract' },
    { pattern: /^introduction/i, name: 'Introduction' },
    { pattern: /^(methods?|methodology)/i, name: 'Methods' },
    { pattern: /^results?/i, name: 'Results' },
    { pattern: /^discussion/i, name: 'Discussion' },
    { pattern: /^conclusion/i, name: 'Conclusion' },
    { pattern: /^references?/i, name: 'References' },
    { pattern: /^(acknowledgments?|acknowledgements?)/i, name: 'Acknowledgments' },
  ]

  for (const section of sections) {
    if (section.pattern.test(lowerText)) {
      return section.name
    }
  }

  return undefined
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Split text into semantic chunks
 * Strategy: Split by paragraphs, combine until reaching target size
 */
export function chunkText(
  fullText: string,
  options: {
    maxTokensPerChunk?: number
    minTokensPerChunk?: number
    overlapTokens?: number
  } = {}
): PaperChunk[] {
  const maxTokens = options.maxTokensPerChunk || 800 // OpenAI embedding limit consideration
  const minTokens = options.minTokensPerChunk || 100
  const overlapTokens = options.overlapTokens || 100

  // Split by double newlines (paragraphs)
  const paragraphs = fullText.split(/\n\n+/).filter((p) => p.trim().length > 0)

  const chunks: PaperChunk[] = []
  let currentChunk = ''
  let currentSection: string | undefined = undefined
  let chunkIndex = 0

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim()

    // Check if this paragraph is a section header
    const detectedSection = detectSection(paragraph)
    if (detectedSection) {
      currentSection = detectedSection
    }

    const paragraphTokens = estimateTokens(paragraph)
    const currentTokens = estimateTokens(currentChunk)

    // If adding this paragraph exceeds max tokens, save current chunk
    if (currentTokens + paragraphTokens > maxTokens && currentChunk.length > 0) {
      if (currentTokens >= minTokens) {
        chunks.push({
          text: currentChunk.trim(),
          chunkIndex,
          section: currentSection,
          tokenCount: currentTokens,
        })
        chunkIndex++

        // Add overlap from the end of the previous chunk
        const words = currentChunk.split(/\s+/)
        const overlapWords = Math.floor(words.length * (overlapTokens / currentTokens))
        currentChunk = words.slice(-overlapWords).join(' ') + '\n\n' + paragraph
      } else {
        currentChunk += '\n\n' + paragraph
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }

  // Add the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      chunkIndex,
      section: currentSection,
      tokenCount: estimateTokens(currentChunk),
    })
  }

  console.log(`✂️  Created ${chunks.length} chunks from ${paragraphs.length} paragraphs`)
  return chunks
}

/**
 * Generate embeddings for text chunks using OpenAI
 */
export async function generateEmbeddings(
  chunks: PaperChunk[],
  model: string = 'text-embedding-3-large'
): Promise<Array<{ chunk: PaperChunk; embedding: number[] }>> {
  console.log(`🧮 Generating embeddings for ${chunks.length} chunks...`)

  const results: Array<{ chunk: PaperChunk; embedding: number[] }> = []

  // Process in batches to avoid rate limits
  const batchSize = 20
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)

    try {
      const response = await openai.embeddings.create({
        model,
        input: batch.map((c) => c.text),
      })

      for (let j = 0; j < batch.length; j++) {
        results.push({
          chunk: batch[j],
          embedding: response.data[j].embedding,
        })
      }

      console.log(`✅ Processed batch ${i / batchSize + 1}/${Math.ceil(chunks.length / batchSize)}`)

      // Rate limiting: wait a bit between batches
      if (i + batchSize < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error(`Error generating embeddings for batch starting at ${i}:`, error)
      throw error
    }
  }

  return results
}

/**
 * Complete pipeline: PDF → Text → Chunks → Embeddings
 */
export async function processPaper(
  pdfBuffer: Buffer,
  options?: {
    maxTokensPerChunk?: number
    minTokensPerChunk?: number
    overlapTokens?: number
  }
): Promise<ProcessedPaper & { embeddings: Array<{ chunk: PaperChunk; embedding: number[] }> }> {
  const fullText = await extractTextFromPDF(pdfBuffer)
  const chunks = chunkText(fullText, options)
  const embeddings = await generateEmbeddings(chunks)

  return {
    fullText,
    chunks,
    embeddings,
    metadata: {
      pages: 0, // pdf-parse provides this, can extract if needed
      extractedAt: new Date(),
      totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
    },
  }
}

