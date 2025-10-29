import { NextResponse } from 'next/server'
import type { ChatMessage, RelevantDocument, SearchStats, SearchResponse } from './types'


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