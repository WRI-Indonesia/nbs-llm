import { prisma } from '@/lib/prisma'

/**
 * Calculates cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

/**
 * Searches for relevant RAG documents using cosine similarity
 */
export async function searchRagDocuments(queryEmbedding: number[], minCosine: number, topK: number) {
  // Get all Node documents with embeddings
  const ragDocs = await (prisma.nodeDocs.findMany as any)({
    where: {
      embedding: {
        not: null
      }
    },
    include: {
      node: {
        include: {
          project: true
        }
      }
    }
  })

  // Calculate similarities and filter by minimum cosine similarity
  const similarities: Array<{ doc: any; similarity: number }> = []

  for (const doc of ragDocs) {
    if (doc.embedding) {
      try {
        const docEmbedding = JSON.parse(doc.embedding) as number[]
        const similarity = cosineSimilarity(queryEmbedding, docEmbedding)

        if (similarity >= minCosine) {
          similarities.push({ doc, similarity })
        }
      } catch (error) {
        console.error('Error parsing embedding for doc:', doc.id, error)
      }
    }
  }

  // Sort by similarity and return top K results
  similarities.sort((a, b) => b.similarity - a.similarity)
  return similarities.slice(0, topK)
}
