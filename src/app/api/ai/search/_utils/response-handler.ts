import { NextResponse } from 'next/server'


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