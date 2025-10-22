import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// import { isAdmin } from '@/lib/auth'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface SearchRequest {
  query: string
  min_cosine: number
  top_k: number
}

// Function to calculate cosine similarity between two vectors
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

// Function to generate embedding for the search query
async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: query,
    })
    
    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating query embedding:', error)
    throw new Error('Failed to generate query embedding')
  }
}

// Function to search for relevant RAG documents
async function searchRagDocuments(queryEmbedding: number[], minCosine: number, topK: number) {
  // Get all RAG documents with embeddings
  const ragDocs = await prisma.ragDocs.findMany({
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
  const similarities = []
  
  for (const doc of ragDocs) {
    if (doc.embedding) {
      try {
        const docEmbedding = JSON.parse(doc.embedding) as number[]
        const similarity = cosineSimilarity(queryEmbedding, docEmbedding)
        
        if (similarity >= minCosine) {
          similarities.push({
            doc,
            similarity
          })
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

// Function to generate SQL query using OpenAI
async function generateSQLQuery(query: string, relevantDocs: any[]): Promise<string> {
  try {
    // Prepare context from relevant documents
    const context = relevantDocs.map(item => ({
      table: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
      text: item.doc.text,
      similarity: item.similarity
    }))

    const prompt = `
You are a SQL expert. Based on the following database schema information and the user's query, generate an appropriate SQL query.

User Query: "${query}"

Relevant Database Schema Information:
${context.map(ctx => `- ${ctx.text} (Similarity: ${ctx.similarity.toFixed(3)})`).join('\n')}

Instructions:
1. Generate a SQL query that answers the user's question
2. Use the table and column names exactly as provided in the schema
3. Include appropriate JOINs if multiple tables are involved
4. Use proper SQL syntax
5. Return only the SQL query, no explanations

SQL Query:`

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a SQL expert. Generate accurate SQL queries based on database schema information."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    })

    return completion.choices[0]?.message?.content?.trim() || ''
  } catch (error) {
    console.error('Error generating SQL query:', error)
    throw new Error('Failed to generate SQL query')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin
    // if (!(await isAdmin())) {
    //   return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    // }

    const body: SearchRequest = await request.json()
    const { query, min_cosine = 0.7, top_k = 5 } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    if (min_cosine < 0 || min_cosine > 1) {
      return NextResponse.json({ error: 'min_cosine must be between 0 and 1' }, { status: 400 })
    }

    if (top_k < 1 || top_k > 20) {
      return NextResponse.json({ error: 'top_k must be between 1 and 20' }, { status: 400 })
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateQueryEmbedding(query)

    // Search for relevant RAG documents
    const relevantDocs = await searchRagDocuments(queryEmbedding, min_cosine, top_k)

    if (relevantDocs.length === 0) {
      return NextResponse.json({
        success: true,
        query,
        message: 'No relevant schema information found for the given query',
        sqlQuery: null,
        relevantDocuments: []
      })
    }

    // Generate SQL query using the relevant documents
    const sqlQuery = await generateSQLQuery(query, relevantDocs)

    return NextResponse.json({
      success: true,
      query,
      sqlQuery,
      relevantDocuments: relevantDocs.map(item => ({
        id: item.doc.id,
        tableName: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
        text: item.doc.text,
        similarity: item.similarity,
        documentType: item.doc.text.includes('Column:') ? 'column' : 'table'
      })),
      searchStats: {
        totalDocumentsFound: relevantDocs.length,
        minCosineThreshold: min_cosine,
        topK: top_k
      }
    })

  } catch (error) {
    console.error('Error in search API:', error)
    return NextResponse.json({ 
      error: 'Failed to process search query',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
