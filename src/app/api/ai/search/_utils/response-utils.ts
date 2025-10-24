import { NextResponse } from 'next/server'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  sqlQuery?: string
  ragDocuments?: any[]
  data?: any
}

export interface RelevantDocument {
  id: string
  tableName: string
  text: string
  similarity: number
  documentType: 'column' | 'table'
}

export interface SearchStats {
  totalDocumentsFound: number
  minCosineThreshold: number
  topK: number
}

export interface SearchResponse {
  success: boolean
  query: string
  sqlQuery?: string | null
  answer?: string
  content?: string
  message?: string
  data: any[]
  chatHistory: ChatMessage[]
  relevantDocuments?: RelevantDocument[]
  searchStats?: SearchStats
}

/**
 * Creates a standardized success response for the search API
 */
export function createSuccessResponse(
  query: string,
  chatHistory: ChatMessage[],
  options: {
    sqlQuery?: string | null
    answer?: string
    content?: string
    message?: string
    data?: any[]
    relevantDocuments?: RelevantDocument[]
    searchStats?: SearchStats
  } = {}
): NextResponse<SearchResponse> {
  const response: SearchResponse = {
    success: true,
    query,
    sqlQuery: options.sqlQuery ?? null,
    answer: options.answer,
    content: options.content,
    message: options.message,
    data: options.data ?? [],
    chatHistory,
    relevantDocuments: options.relevantDocuments,
    searchStats: options.searchStats
  }

  return NextResponse.json(response)
}

/**
 * Creates a standardized error response for the search API
 */
export function createErrorResponse(
  error: string,
  details?: string,
  status: number = 500
): NextResponse {
  return NextResponse.json({
    error,
    details
  }, { status })
}

/**
 * Maps RAG documents to the standardized format
 */
export function mapRelevantDocuments(relevantDocs: any[]): RelevantDocument[] {
  return relevantDocs.map(item => ({
    id: item.doc.id,
    tableName: item.doc.node?.data ? JSON.parse(JSON.stringify(item.doc.node.data)).table : 'Unknown',
    text: item.doc.text,
    similarity: item.similarity,
    documentType: item.doc.text.includes('Column:') ? 'column' : 'table'
  }))
}

/**
 * Creates search stats object
 */
export function createSearchStats(
  totalDocumentsFound: number,
  minCosineThreshold: number,
  topK: number
): SearchStats {
  return {
    totalDocumentsFound,
    minCosineThreshold,
    topK
  }
}
