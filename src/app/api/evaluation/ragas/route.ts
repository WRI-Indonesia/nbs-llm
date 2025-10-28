import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
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

// Context Precision - Measures how relevant the retrieved context is
function contextPrecision(retrievedContext: string[], query: string, minCosine: number = 0.7): number {
  if (retrievedContext.length === 0) return 0

  // For simplicity, we consider context relevant if it's similar to the query
  // In real implementation, you'd use semantic similarity
  let relevantCount = 0
  const queryLower = query.toLowerCase()

  for (const context of retrievedContext) {
    const contextLower = context.toLowerCase()
    // Simple keyword matching - in production, use embedding similarity
    const hasRelevantTerms = queryLower.split(' ').some(term => 
      contextLower.includes(term) && term.length > 3
    )
    if (hasRelevantTerms) {
      relevantCount++
    }
  }

  return relevantCount / retrievedContext.length
}

// Context Recall - Measures how much relevant context was retrieved
function contextRecall(retrievedContext: string[], allRelevantContext: string[]): number {
  if (allRelevantContext.length === 0) return 0

  let retrievedRelevantCount = 0
  const retrievedSet = new Set(retrievedContext.map(c => c.substring(0, 100)))

  for (const relevant of allRelevantContext) {
    const key = relevant.substring(0, 100)
    if (retrievedSet.has(key)) {
      retrievedRelevantCount++
    }
  }

  return retrievedRelevantCount / allRelevantContext.length
}

// Faithfulness - Measures how factually consistent the answer is with the context
function faithfulness(answer: string, context: string[]): number {
  if (context.length === 0 || !answer) return 0

  // Simple implementation: count how many claims in the answer appear in context
  const answerSentences = answer.split('.').filter(s => s.trim().length > 10)
  const allContext = context.join(' ').toLowerCase()

  let matchedSentences = 0
  for (const sentence of answerSentences) {
    const sentenceKey = sentence.trim().substring(0, 30).toLowerCase()
    if (allContext.includes(sentenceKey)) {
      matchedSentences++
    }
  }

  return answerSentences.length > 0 ? matchedSentences / answerSentences.length : 0
}

// Answer Relevance - Measures how relevant the answer is to the question
function answerRelevance(question: string, answer: string): number {
  if (!question || !answer) return 0

  // Simple keyword overlap
  const questionWords = new Set(question.toLowerCase().split(/\W+/).filter(w => w.length > 3))
  const answerWords = new Set(answer.toLowerCase().split(/\W+/).filter(w => w.length > 3))

  let matches = 0
  questionWords.forEach(word => {
    if (answerWords.has(word)) matches++
  })

  return questionWords.size > 0 ? matches / questionWords.size : 0
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    // if (!(await isAdmin())) {
    //   return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    // }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId') || 'DEFAULT'
    const limit = parseInt(searchParams.get('limit') || '10')
    const sampleSize = parseInt(searchParams.get('sampleSize') || '5')

    // Get MinioDocs for the project
    const allDocs = await prisma.minioDocs.findMany({
      where: {
        projectId,
        embedding: { not: null }
      },
      include: {
        project: true
      }
    })

    if (allDocs.length === 0) {
      return NextResponse.json({
        error: 'No documents found in MinioDocs for this project'
      }, { status: 404 })
    }

    // Sample documents for evaluation
    const sampledDocs = allDocs.slice(0, Math.min(sampleSize, allDocs.length))
    
    // Generate sample questions and evaluate
    const evaluationResults = []

    for (const doc of sampledDocs) {
      try {
        // Simulate a query based on the document
        const query = doc.text.substring(0, 100)
        
        // Find similar documents (simulate retrieval)
        const queryEmbedding = doc.embedding ? JSON.parse(doc.embedding as string) as number[] : null
        const retrievedDocs: string[] = []
        
        if (queryEmbedding) {
          const similarities = []
          for (const otherDoc of allDocs.slice(0, limit)) {
            if (otherDoc.embedding) {
              try {
                const otherEmbedding = JSON.parse(otherDoc.embedding as string) as number[]
                const similarity = cosineSimilarity(queryEmbedding, otherEmbedding)
                if (similarity > 0.7) {
                  similarities.push({ doc: otherDoc, similarity })
                }
              } catch (e) {
                // Skip invalid embeddings
              }
            }
          }
          
          retrievedDocs.push(...similarities.slice(0, 5).map(s => s.doc.text))
        }

        // Calculate metrics
        const context = retrievedDocs.length > 0 ? retrievedDocs : [doc.text]
        const contextPrecisionScore = contextPrecision(retrievedDocs.slice(0, 3), query)
        const contextRecallScore = contextRecall(retrievedDocs.slice(0, 3), [doc.text, ...retrievedDocs])
        const faithfulnessScore = faithfulness(doc.text, context)
        const answerRelevanceScore = answerRelevance(query, doc.text)

        const averageScore = (
          contextPrecisionScore + 
          contextRecallScore + 
          faithfulnessScore + 
          answerRelevanceScore
        ) / 4

        evaluationResults.push({
          docId: doc.id,
          fileName: doc.fileName,
          query: query,
          metrics: {
            contextPrecision: contextPrecisionScore,
            contextRecall: contextRecallScore,
            faithfulness: faithfulnessScore,
            answerRelevance: answerRelevanceScore,
            averageScore: averageScore
          },
          retrievedDocsCount: retrievedDocs.length,
          textPreview: doc.text.substring(0, 200)
        })
      } catch (error) {
        console.error(`Error evaluating doc ${doc.id}:`, error)
        // Continue with other documents
      }
    }

    // Calculate overall statistics
    const overallMetrics = {
      contextPrecision: evaluationResults.reduce((sum, r) => sum + r.metrics.contextPrecision, 0) / evaluationResults.length,
      contextRecall: evaluationResults.reduce((sum, r) => sum + r.metrics.contextRecall, 0) / evaluationResults.length,
      faithfulness: evaluationResults.reduce((sum, r) => sum + r.metrics.faithfulness, 0) / evaluationResults.length,
      answerRelevance: evaluationResults.reduce((sum, r) => sum + r.metrics.answerRelevance, 0) / evaluationResults.length,
      averageScore: evaluationResults.reduce((sum, r) => sum + r.metrics.averageScore, 0) / evaluationResults.length
    }

    return NextResponse.json({
      projectId,
      totalDocs: allDocs.length,
      evaluatedDocs: evaluationResults.length,
      overallMetrics,
      evaluations: evaluationResults
    })

  } catch (error) {
    console.error('Error evaluating MinioDocs:', error)
    return NextResponse.json({ 
      error: 'Failed to evaluate documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    // if (!(await isAdmin())) {
    //   return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    // }

    const body = await request.json()
    const { projectId = 'DEFAULT', queries, topK = 5 } = body

    if (!queries || !Array.isArray(queries)) {
      return NextResponse.json({ error: 'Queries array is required' }, { status: 400 })
    }

    // Get all documents with embeddings
    const allDocs = await prisma.minioDocs.findMany({
      where: {
        projectId,
        embedding: { not: null }
      }
    })

    if (allDocs.length === 0) {
      return NextResponse.json({
        error: 'No documents found in MinioDocs for this project'
      }, { status: 404 })
    }

    const results = []

    for (const query of queries) {
      // For each query, find most similar documents
      const queryLower = query.toLowerCase()
      const queryTerms = queryLower.split(' ').filter((w: string | any[]) => w.length > 3)
      
      const matchedDocs = allDocs
        .map(doc => {
          const docText = doc.text.toLowerCase()
          let score = 0
          
          // Simple keyword matching score
          for (const term of queryTerms) {
            if (docText.includes(term)) {
              score += 1
            }
          }
          
          // Normalize by query terms count
          score = score / queryTerms.length
          
          return { doc, score }
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
      
      if (matchedDocs.length > 0) {
        const topDocs = matchedDocs.map(m => m.doc)
        const context = topDocs.map(d => d.text).slice(0, 3)
        
        // Calculate RAGAS metrics for this query
        const retrievalPrecision = matchedDocs[0].score
        const retrievalRecall = Math.min(matchedDocs.length / allDocs.length, 1)
        
        // Context diversity (how different are the retrieved docs)
        const contextDiversity = new Set(matchedDocs.slice(0, 3).map(m => m.doc.fileName)).size / Math.min(3, matchedDocs.length)
        
        results.push({
          query,
          topDocuments: topDocs.map(d => ({
            id: d.id,
            fileName: d.fileName,
            textPreview: d.text.substring(0, 150),
            score: matchedDocs.find(m => m.doc.id === d.id)?.score || 0
          })),
          metrics: {
            retrievalPrecision,
            retrievalRecall,
            contextDiversity,
            averageScore: (retrievalPrecision + retrievalRecall + contextDiversity) / 3
          }
        })
      }
    }

    // Calculate overall metrics
    const overallMetrics = results.length > 0 ? {
      averageRetrievalPrecision: results.reduce((sum, r) => sum + r.metrics.retrievalPrecision, 0) / results.length,
      averageRetrievalRecall: results.reduce((sum, r) => sum + r.metrics.retrievalRecall, 0) / results.length,
      averageContextDiversity: results.reduce((sum, r) => sum + r.metrics.contextDiversity, 0) / results.length,
      overallScore: results.reduce((sum, r) => sum + r.metrics.averageScore, 0) / results.length
    } : null

    return NextResponse.json({
      projectId,
      totalDocs: allDocs.length,
      evaluatedQueries: results.length,
      overallMetrics,
      results
    })

  } catch (error) {
    console.error('Error evaluating with custom queries:', error)
    return NextResponse.json({ 
      error: 'Failed to evaluate documents',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

