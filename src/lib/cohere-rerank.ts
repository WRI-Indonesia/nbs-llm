/**
 * Cohere Rerank Integration
 * Improves retrieval relevance by re-ranking candidate documents
 */

import { CohereClient } from "cohere-ai"

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || '',
})

export interface RerankDocument {
  text: string
  doc: any
  similarity: number
}

export interface RerankResult {
  doc: any
  similarity: number
  rerankScore?: number
}

/**
 * Rerank documents using Cohere Rerank API
 * 
 * @param query User's original query
 * @param documents Candidate documents from first-pass retrieval
 * @param topN Number of top documents to return after reranking
 * @returns Reranked documents sorted by relevance
 */
export async function rerankDocuments(
  query: string,
  documents: RerankDocument[],
  topN: number = 5
): Promise<RerankResult[]> {
  if (!process.env.COHERE_API_KEY) {
    console.warn('⚠️  Cohere API key not found. Skipping rerank.')
    return documents.slice(0, topN).map(d => ({
      doc: d.doc,
      similarity: d.similarity
    }))
  }

  if (documents.length === 0) {
    return []
  }

  if (documents.length <= topN) {
    // If we already have ≤ topN documents, no need to rerank
    return documents.map(d => ({
      doc: d.doc,
      similarity: d.similarity
    }))
  }

  try {
    console.log(`🔄 Reranking ${documents.length} documents for query: "${query.substring(0, 50)}..."`)

    // Prepare documents for reranking
    const documentsToRerank = documents.map(d => ({
      text: d.text
    }))

    // Call Cohere Rerank API
    const rerankResponse = await cohere.rerank({
      model: 'rerank-english-v3.0',
      query: query,
      documents: documentsToRerank,
      topN: topN,
      returnDocuments: false
    })

    if (!rerankResponse.results) {
      console.warn('No rerank results returned')
      return documents.slice(0, topN).map(d => ({
        doc: d.doc,
        similarity: d.similarity
      }))
    }

    console.log(`✅ Reranked ${rerankResponse.results.length} documents`)

    // Map rerank results back to original documents
    const reranked = rerankResponse.results
      .map((result) => {
        const originalIndex = result.index
        const originalDoc = documents[originalIndex]
        
        return {
          doc: originalDoc.doc,
          similarity: originalDoc.similarity,
          rerankScore: result.relevanceScore
        }
      })
      .filter(item => item.doc)

    return reranked
  } catch (error) {
    console.error('Error reranking documents:', error)
    // Fallback to original topK by similarity
    return documents.slice(0, topN).map(d => ({
      doc: d.doc,
      similarity: d.similarity
    }))
  }
}

/**
 * Rerank schema documents with enhanced context
 */
export async function rerankSchemaDocuments(
  query: string,
  documents: Array<{ doc: any; similarity: number }>,
  topN: number = 5
): Promise<RerankResult[]> {
  const documentsWithText = documents.map(d => ({
    text: d.doc.text,
    doc: d.doc,
    similarity: d.similarity
  }))

  return rerankDocuments(query, documentsWithText, topN)
}

/**
 * Rerank paper documents with enhanced metadata
 */
export async function rerankPaperDocuments(
  query: string,
  documents: Array<{ doc: any; similarity: number; payload: any }>,
  topN: number = 5
): Promise<Array<RerankResult & { payload?: any }>> {
  // Enhance text with metadata for better reranking
  const documentsWithText = documents.map(d => {
    const payload = d.payload || {}
    const enhancedText = [
      `Title: ${payload.title || 'Unknown'}`,
      `Authors: ${payload.authors || 'Unknown'}`,
      `Section: ${payload.section || 'Unknown'}`,
      `Content: ${d.doc.text}`
    ].join('\n')

    return {
      text: enhancedText,
      doc: d.doc,
      similarity: d.similarity,
      payload: d.payload
    }
  })

  const reranked = await rerankDocuments(query, documentsWithText, topN)
  
  // Attach payload to results
  return reranked.map(result => {
    const original = documents.find(d => d.doc.id === result.doc.id)
    return {
      ...result,
      payload: original?.payload
    }
  })
}